import { Router } from 'express';
import { body } from 'express-validator';
import * as invitationController from '../controllers/invitation.controller.js';
import * as authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// Send invitation
router.post('/send',
    authMiddleware.authUser,
    body('projectId').isString().withMessage('Project ID is required'),
    body('recipientId').isString().withMessage('Recipient ID is required'),
    invitationController.sendInvitation
);

// Get user's pending invitations
router.get('/pending',
    authMiddleware.authUser,
    invitationController.getPendingInvitations
);

// Accept invitation
router.post('/accept/:invitationId',
    authMiddleware.authUser,
    invitationController.acceptInvitation
);

// Reject invitation
router.post('/reject/:invitationId',
    authMiddleware.authUser,
    invitationController.rejectInvitation
);

// Get sent invitations for a project
router.get('/sent/:projectId',
    authMiddleware.authUser,
    invitationController.getSentInvitations
);

export default router;