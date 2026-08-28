# Changelog

## 1.1.0 - 2026-08-28

### Funcionalidad
- Recuperación de contraseña desde el frontend con Amazon Cognito.
- Reenvío de códigos de confirmación.
- Mensajes de errores comunes de Cognito traducidos a mensajes más claros en español.
- Estados de carga en botones de acceso, registro, recuperación y actualización.
- Etiquetas de clasificación visibles en español sin cambiar los valores almacenados en DynamoDB.
- Aclaración visible de que `PUBLIC`, `INTERNAL` y `CONFIDENTIAL` son etiquetas descriptivas en el MVP y no hacen público ningún archivo.

### Seguridad
- API Gateway usa `SecurityPolicy_TLS12_PFS_2025_EDGE`; el script permite migrar de `BASIC` a `STRICT` en dos pasos para pilas existentes.
- CORS de API Gateway, Lambda y S3 de documentos restringido al dominio CloudFront del stack.
- CloudFront adjunta la política administrada `SecurityHeadersPolicy`.
- Nuevo grupo CloudWatch administrado por CloudFormation con retención de 14 días y logs JSON.
- El script de despliegue ajusta a 14 días la retención del grupo de logs legado si existe.

### Documentación
- README y documentación de arquitectura actualizados a la versión 1.1.
