import { Router } from 'express';
import {
  createUser,
  deleteUser,
  findUserById,
  findUserByUsername,
  toPublicUser,
  updatePassword,
  updateProfile,
  verifyPassword,
} from '../repos/users';
import { signToken } from '../auth/tokens';
import { requireAuth, type AuthedRequest } from '../auth/middleware';

const router = Router();

const USERNAME_RE = /^[a-z0-9_.]{2,60}$/;

router.post('/auth/signup', async (req, res) => {
  const { name, username, password } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Username must be 2+ chars: letters, numbers, "." or "_".' });
  }
  if (typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }
  const uname = username.trim().toLowerCase();
  try {
    if (await findUserByUsername(uname)) return res.status(409).json({ error: 'That username is already taken.' });
    const user = await createUser({ name: name.trim(), username: uname, password });
    return res.json({ token: signToken({ sub: user.id, username: user.username }), user: toPublicUser(user) });
  } catch (e) {
    if ((e as { code?: string }).code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    console.error('[POST /api/auth/signup]', e);
    return res.status(500).json({ error: 'Could not create account.' });
  }
});

router.post('/auth/login', async (req, res) => {
  const { username, password } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const user = await findUserByUsername(username.trim().toLowerCase());
  if (!user || !(await verifyPassword(user, password))) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  return res.json({ token: signToken({ sub: user.id, username: user.username }), user: toPublicUser(user) });
});

router.get('/auth/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await findUserById(req.auth!.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: toPublicUser(user) });
});

router.patch('/auth/profile', requireAuth, async (req: AuthedRequest, res) => {
  const { name, username, preferredLanguage } = (req.body ?? {}) as Record<string, unknown>;
  const patch: { name?: string; username?: string; preferredLanguage?: string } = {};
  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (typeof preferredLanguage === 'string') patch.preferredLanguage = preferredLanguage;
  if (typeof username === 'string' && username.trim()) {
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) return res.status(400).json({ error: 'Invalid username.' });
    const existing = await findUserByUsername(uname);
    if (existing && existing.id !== req.auth!.sub) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    patch.username = uname;
  }
  await updateProfile(req.auth!.sub, patch);
  const user = await findUserById(req.auth!.sub);
  return res.json({ user: toPublicUser(user!) });
});

router.post('/auth/password', requireAuth, async (req: AuthedRequest, res) => {
  const { current, next } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof current !== 'string' || typeof next !== 'string') {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (next.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters.' });
  const user = await findUserById(req.auth!.sub);
  if (!user || !(await verifyPassword(user, current))) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  await updatePassword(user.id, next);
  return res.json({ ok: true });
});

router.delete('/auth/account', requireAuth, async (req: AuthedRequest, res) => {
  await deleteUser(req.auth!.sub);
  return res.json({ ok: true });
});

export default router;
