require('../helpers');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app')();
const users = require('../../src/repositories/userRepository');
const profile = require('../../src/services/profileService');
const { hashPassword, verifyPassword } = require('../../src/utils/password');
const { uniqueEmail } = require('../helpers');
const { waitForDatabase, runMigrations } = require('../../src/db/migrate');
const { closePool } = require('../../src/db/pool');
before(async () => {
  await waitForDatabase();
  await runMigrations();
});
after(() => closePool());
for (const action of ['changePassword', 'deleteAccount']) {
  test(`${action} rechaza una contraseña revocada durante la verificación`, async () => {
    const { body } = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Race', email: uniqueEmail('race'), password: 'secret123', acceptTerms: true })
      .expect(201);
    const id = body.user.id,
      newHash = await hashPassword('changed-password');
    const original = users.findPasswordHash;
    let first = true;
    users.findPasswordHash = async (...args) => {
      const hash = await original(...args);
      if (first) {
        first = false;
        await users.updatePassword(id, newHash);
      }
      return hash;
    };
    try {
      await assert.rejects(
        action === 'changePassword'
          ? profile.changePassword(id, { currentPassword: 'secret123', newPassword: 'old-session-change' })
          : profile.deleteAccount(id, { password: 'secret123' }),
        /contraseña cambió/,
      );
    } finally {
      users.findPasswordHash = original;
    }
    assert.ok(await users.findById(id));
    assert.equal((await verifyPassword('changed-password', await original(id))).valid, true);
  });
}
