import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { getOne, query, runSync, transaction } from '../config/db.js';
import { pteroManage } from '../services/pteroManage.js';

const router = Router();

// Rate limiter for backup operations: max 10 per 5 minutes per user
const backupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `backup_${req.user?.id ?? req.ip}`,
  message: { error: 'Too many backup operations. Please slow down.' }
});

// Validation schemas
const createBackupSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9 _\-.:]+$/, "Backup name can only contain letters, numbers, spaces, hyphens, underscores, dots, and colons").optional()
  }).optional().default({})
});

const backupUuidParamSchema = z.object({
  params: z.object({
    serverId: z.coerce.number().int().positive(),
    backupUuid: z.string().uuid("Invalid backup UUID format")
  })
});

/**
 * Resolve Pterodactyl server details (uuid + node) for backup operations.
 * Uses pteroManage (Application API + Wings) — no Client API key required.
 */
async function resolveServerForBackup(req, res) {
  const serverId = Number(req.params.serverId);
  if (!serverId || isNaN(serverId)) {
    res.status(400).json({ error: 'Invalid server ID' });
    return null;
  }

  const server = await getOne(
    'SELECT id, user_id, pterodactyl_server_id, plan_type, plan_id FROM servers WHERE id = ? AND user_id = ? AND status != ?',
    [serverId, req.user.id, 'deleted']
  );
  if (!server) {
    res.status(404).json({ error: 'Server not found' });
    return null;
  }

  try {
    const details = await pteroManage.getServerDetails(server.pterodactyl_server_id);
    return { server, ptero: details };
  } catch {
    res.status(502).json({ error: 'Failed to reach server panel' });
    return null;
  }
}

// Get all backups for a server
router.get('/:serverId/backups', requireAuth, async (req, res, next) => {
  try {
    const ctx = await resolveServerForBackup(req, res);
    if (!ctx) return;
    const { server } = ctx;

    // Get backup limit from plan
    const plan = await getOne(
      `SELECT backup_count FROM ${server.plan_type === 'coin' ? 'plans_coin' : 'plans_real'} WHERE id = ?`,
      [server.plan_id]
    );
    const backupLimit = plan?.backup_count || 0;

    // Get backups tracked in our database (source of truth for metadata)
    const dbBackups = await query(
      'SELECT id, pterodactyl_backup_uuid as uuid, name, created_at FROM server_backups WHERE server_id = ? ORDER BY created_at DESC',
      [server.id]
    );

    const backups = dbBackups.map(b => ({
      uuid: b.uuid,
      name: b.name,
      created_at: b.created_at,
      is_successful: true,
      tracked: true
    }));

    res.json({
      backups,
      limit: backupLimit,
      used: backups.length
    });
  } catch (error) {
    next(error);
  }
});

// Create a new backup
router.post('/:serverId/backups', requireAuth, backupLimiter, validate(createBackupSchema), async (req, res, next) => {
  try {
    const ctx = await resolveServerForBackup(req, res);
    if (!ctx) return;
    const { server, ptero } = ctx;
    const { name } = req.body || {};

    // Generate a UUID for the backup
    const backupUuid = randomUUID();
    const backupName = name || `backup-${new Date().toISOString().split('T')[0]}`;

    // Atomic check-and-insert to prevent race condition on backup limit
    await transaction(({ query: txQuery, getOne: txGetOne, runSync: txRun }) => {
      // Get backup limit from plan
      const plan = txGetOne(
        `SELECT backup_count FROM ${server.plan_type === 'coin' ? 'plans_coin' : 'plans_real'} WHERE id = ?`,
        [server.plan_id]
      );
      const backupLimit = plan?.backup_count || 0;

      if (backupLimit === 0) {
        throw Object.assign(new Error('Your plan does not include backups'), { statusCode: 403 });
      }

      // Check current backup count inside the transaction
      const currentBackups = txQuery('SELECT id FROM server_backups WHERE server_id = ?', [server.id]);
      if (currentBackups.length >= backupLimit) {
        throw Object.assign(new Error(`Backup limit reached (${backupLimit}). Please delete old backups first.`), { statusCode: 403 });
      }

      // Reserve the slot in our database first
      txRun(
        'INSERT INTO server_backups (server_id, pterodactyl_backup_uuid, name) VALUES (?, ?, ?)',
        [server.id, backupUuid, backupName]
      );
    });

    // Create the backup on Wings (outside transaction — external call)
    try {
      await pteroManage.createBackup(ptero.uuid, ptero.node, backupUuid);
    } catch (wingsError) {
      // Rollback DB entry if Wings call fails
      await runSync('DELETE FROM server_backups WHERE server_id = ? AND pterodactyl_backup_uuid = ?', [server.id, backupUuid]);
      throw wingsError;
    }

    res.status(201).json({
      message: 'Backup created successfully',
      uuid: backupUuid
    });
  } catch (error) {
    next(error);
  }
});

// Delete a backup
router.delete('/:serverId/backups/:backupUuid', requireAuth, backupLimiter, validate(backupUuidParamSchema), async (req, res, next) => {
  try {
    const ctx = await resolveServerForBackup(req, res);
    if (!ctx) return;
    const { server, ptero } = ctx;
    const { backupUuid } = req.params;

    // Delete from Wings
    await pteroManage.deleteBackup(ptero.uuid, ptero.node, backupUuid);

    // Remove from our database
    await runSync(
      'DELETE FROM server_backups WHERE server_id = ? AND pterodactyl_backup_uuid = ?',
      [server.id, backupUuid]
    );

    res.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Restore a backup
router.post('/:serverId/backups/:backupUuid/restore', requireAuth, backupLimiter, validate(backupUuidParamSchema), async (req, res, next) => {
  try {
    const ctx = await resolveServerForBackup(req, res);
    if (!ctx) return;
    const { ptero } = ctx;
    const { backupUuid } = req.params;

    await pteroManage.restoreBackup(ptero.uuid, ptero.node, backupUuid);
    res.json({ message: 'Backup restore initiated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get backup download URL
router.get('/:serverId/backups/:backupUuid/download', requireAuth, validate(backupUuidParamSchema), async (req, res, next) => {
  try {
    const ctx = await resolveServerForBackup(req, res);
    if (!ctx) return;
    const { ptero } = ctx;
    const { backupUuid } = req.params;

    const downloadUrl = await pteroManage.getBackupDownloadUrl(ptero.uuid, ptero.node, backupUuid);
    res.json({ url: downloadUrl });
  } catch (error) {
    next(error);
  }
});

export default router;
