const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
// El digest, las claves JSON y una contraseña de 128 caracteres escapados caben en 1 KiB.
const MAX_RESTORE_BYTES = MAX_BACKUP_BYTES + 1024;

module.exports = { MAX_BACKUP_BYTES, MAX_RESTORE_BYTES };
