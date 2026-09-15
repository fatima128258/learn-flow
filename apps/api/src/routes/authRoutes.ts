import { Router } from 'express';
import { register, login, logout, forgotPassword, resendForgotPassword, verifyForgotPassword, resetPassword, verifyEmail, resendVerification, getMe, updateEmail, changePassword } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/forgot-password/resend', resendForgotPassword);
router.post('/forgot-password/verify', verifyForgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateEmail);
router.patch('/password', requireAuth, changePassword);

export default router;
