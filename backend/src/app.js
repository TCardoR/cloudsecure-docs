import crypto from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { validateUploadInput } from './validation.js';

const TABLE_NAME = process.env.DOCUMENTS_TABLE;
const BUCKET_NAME = process.env.DOCUMENTS_BUCKET;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const s3 = new S3Client({});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
};

function response(statusCode, body = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function getOwner(event) {
  const claims = event?.requestContext?.authorizer?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: claims.email || ''
  };
}

async function getDocument(ownerId, documentId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { ownerId, documentId }
  }));
  return result.Item || null;
}

async function listDocuments(ownerId) {
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'ownerId = :ownerId',
    ExpressionAttributeValues: {
      ':ownerId': ownerId
    },
    ScanIndexForward: false
  }));

  const items = (result.Items || [])
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(({ s3Key, ownerId: _ownerId, ...publicItem }) => publicItem);

  return response(200, { items });
}

async function createUploadUrl(event, owner) {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: 'El cuerpo JSON no es válido.' });
  }

  const validation = validateUploadInput(body);
  if (!validation.ok) {
    return response(400, { message: validation.message });
  }

  const { filename, safeFilename, contentType, category, classification, size } = validation.value;
  const documentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const s3Key = `${owner.id}/${documentId}/${safeFilename}`;

  const putCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 300 });

  await dynamo.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ownerId: owner.id,
      documentId,
      filename,
      s3Key,
      contentType,
      size,
      category,
      classification,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now
    },
    ConditionExpression: 'attribute_not_exists(ownerId) AND attribute_not_exists(documentId)'
  }));

  return response(201, {
    documentId,
    uploadUrl,
    expiresInSeconds: 300
  });
}

async function completeUpload(ownerId, documentId) {
  const document = await getDocument(ownerId, documentId);
  if (!document) {
    return response(404, { message: 'Documento no encontrado.' });
  }

  await dynamo.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { ownerId, documentId },
    UpdateExpression: 'SET #status = :ready, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':ready': 'READY',
      ':updatedAt': new Date().toISOString()
    }
  }));

  return response(200, { message: 'Documento confirmado correctamente.' });
}

async function createDownloadUrl(ownerId, documentId) {
  const document = await getDocument(ownerId, documentId);
  if (!document || document.status !== 'READY') {
    return response(404, { message: 'Documento no encontrado o carga incompleta.' });
  }

  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: document.s3Key,
      ResponseContentDisposition: `attachment; filename="${document.filename.replaceAll('"', '')}"`
    }),
    { expiresIn: 120 }
  );

  return response(200, {
    downloadUrl,
    expiresInSeconds: 120
  });
}

async function deleteDocument(ownerId, documentId) {
  const document = await getDocument(ownerId, documentId);
  if (!document) {
    return response(404, { message: 'Documento no encontrado.' });
  }

  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: document.s3Key
  }));

  await dynamo.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { ownerId, documentId }
  }));

  return response(200, { message: 'Documento eliminado correctamente.' });
}

export async function handler(event) {
  try {
    const owner = getOwner(event);
    if (!owner) {
      return response(401, { message: 'No fue posible identificar al usuario autenticado.' });
    }

    const method = event.httpMethod;
    const path = event.resource || event.path;
    const documentId = event.pathParameters?.documentId;

    if (method === 'GET' && path === '/documents') {
      return await listDocuments(owner.id);
    }

    if (method === 'POST' && path === '/documents/upload-url') {
      return await createUploadUrl(event, owner);
    }

    if (method === 'POST' && path === '/documents/{documentId}/complete') {
      return await completeUpload(owner.id, documentId);
    }

    if (method === 'GET' && path === '/documents/{documentId}/download') {
      return await createDownloadUrl(owner.id, documentId);
    }

    if (method === 'DELETE' && path === '/documents/{documentId}') {
      return await deleteDocument(owner.id, documentId);
    }

    return response(404, { message: 'Ruta no encontrada.' });
  } catch (error) {
    console.error('Unhandled error:', error);
    return response(500, {
      message: 'Ocurrió un error interno. Revisa los logs de CloudWatch.'
    });
  }
}
