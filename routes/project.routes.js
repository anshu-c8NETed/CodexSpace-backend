import { Router } from 'express';
import { body } from 'express-validator';
import * as projectController from '../controllers/project.controller.js';
import * as authMiddleWare from '../middleware/auth.middleware.js';

const router = Router();

// Create new project
router.post('/create',
    authMiddleWare.authUser,
    [
        body('name')
            .trim()
            .notEmpty().withMessage('Name is required')
            .isLength({ min: 3 }).withMessage('Name must be at least 3 characters long')
            .isLength({ max: 50 }).withMessage('Name must not exceed 50 characters')
    ],
    projectController.createProject
);

// Get all projects for logged-in user
router.get('/all',
    authMiddleWare.authUser,
    projectController.getAllProject
);

// Add users to project (collaborators)
router.put('/add-user',
    authMiddleWare.authUser,
    [
        body('projectId')
            .notEmpty().withMessage('Project ID is required')
            .isMongoId().withMessage('Invalid project ID format'),
        body('users')
            .isArray({ min: 1 }).withMessage('Users must be an array with at least one user')
            .custom((users) => users.every(user => typeof user === 'string'))
            .withMessage('Each user must be a string')
    ],
    projectController.addUserToProject
);

// Remove user from project
router.put('/remove-user',
    authMiddleWare.authUser,
    [
        body('projectId')
            .notEmpty().withMessage('Project ID is required')
            .isMongoId().withMessage('Invalid project ID format'),
        body('userIdToRemove')
            .notEmpty().withMessage('User ID to remove is required')
            .isMongoId().withMessage('Invalid user ID format')
    ],
    projectController.removeUserFromProject
);

// Get specific project by ID
router.get('/get-project/:projectId',
    authMiddleWare.authUser,
    projectController.getProjectById
);

// Update file tree
router.put('/update-file-tree',
    authMiddleWare.authUser,
    [
        body('projectId')
            .notEmpty().withMessage('Project ID is required')
            .isMongoId().withMessage('Invalid project ID format'),
        body('fileTree')
            .isObject().withMessage('File tree must be an object')
    ],
    projectController.updateFileTree
);

// Search users by email for adding collaborators
router.get('/search-users/:projectId',
    authMiddleWare.authUser,
    projectController.searchUsersByEmail
);

// Delete project (owner only)
router.delete('/delete/:projectId',
    authMiddleWare.authUser,
    projectController.deleteProject
);

export default router;
