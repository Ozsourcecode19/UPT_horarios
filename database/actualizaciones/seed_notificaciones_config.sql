-- seed_notificaciones_config.sql
-- Semilla de claves de configuración para el módulo de Notificaciones (SMTP).
-- Ejecutar: psql -U postgres -d horarios_upt -f seed_notificaciones_config.sql

INSERT INTO configuracion (clave, valor, tipo_dato, descripcion, editable)
VALUES
  ('smtp_server', '', 'string', 'Servidor SMTP para envío de correos (ej. smtp.gmail.com)', true),
  ('smtp_port', 587, 'integer', 'Puerto del servidor SMTP (típicamente 587 con TLS o 465 con SSL)', true),
  ('smtp_username', '', 'string', 'Usuario o correo remitente para autenticación SMTP', true),
  ('smtp_use_tls', true, 'boolean', 'Usar TLS al conectar con el servidor SMTP', true),
  ('notificaciones_email_generacion', false, 'boolean', 'Enviar correo cuando finaliza la generación automática de horarios', true),
  ('notificaciones_email_errores', false, 'boolean', 'Enviar correo cuando ocurre un error en el sistema de horarios', true)
ON CONFLICT (clave) DO NOTHING;
