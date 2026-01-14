import projectModel from '../models/project.model.js';
import * as projectService from '../services/project.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';

/**
 * Create a new project
 * FIXED: Uses updated service with explicit owner
 */
export const createProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            errors: errors.array(),
            message: errors.array()[0].msg 
        });
    }

    try {
        const { name } = req.body;
        
        // Get logged-in user
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = loggedInUser._id;

        // Create project with explicit owner
        const newProject = await projectService.createProject({ name, userId });

        res.status(201).json({
            project: newProject,
            message: 'Workspace created successfully'
        });

    } catch (err) {
        console.error('Create project error:', err);
        
        // Handle specific errors
        if (err.message.includes('already exists')) {
            return res.status(400).json({ 
                error: err.message,
                type: 'duplicate_name'
            });
        }
        
        if (err.message.includes('at least 3 characters')) {
            return res.status(400).json({ 
                error: err.message,
                type: 'validation_error'
            });
        }
        
        res.status(400).json({ 
            error: err.message || 'Failed to create workspace'
        });
    }
};

/**
 * Get all projects for logged-in user
 * FIXED: Returns projects with proper owner information
 */
export const getAllProject = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const allUserProjects = await projectService.getAllProjectByUserId({
            userId: loggedInUser._id
        });

        return res.status(200).json({
            projects: allUserProjects,
            count: allUserProjects.length
        });

    } catch (err) {
        console.error('Get all projects error:', err);
        res.status(400).json({ error: err.message });
    }
};

/**
 * Add users to project
 * FIXED: Validates ownership before allowing
 */
export const addUserToProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            errors: errors.array(),
            message: errors.array()[0].msg 
        });
    }

    try {
        const { projectId, users } = req.body;

        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const project = await projectService.addUsersToProject({
            projectId,
            users,
            userId: loggedInUser._id
        });

        return res.status(200).json({
            project,
            message: `Successfully added ${users.length} collaborator${users.length !== 1 ? 's' : ''}`
        });

    } catch (err) {
        console.error('Add user to project error:', err);
        
        if (err.message.includes('Only the project owner')) {
            return res.status(403).json({ 
                error: err.message,
                type: 'permission_denied'
            });
        }
        
        if (err.message.includes('already members')) {
            return res.status(400).json({ 
                error: err.message,
                type: 'duplicate_members'
            });
        }
        
        res.status(400).json({ error: err.message });
    }
};

/**
 * Get project by ID
 * FIXED: Always returns proper owner information
 */
export const getProjectById = async (req, res) => {
    const { projectId } = req.params;

    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const project = await projectService.getProjectById({ projectId });

        // Verify user has access to this project
        if (!project.isMember(loggedInUser._id)) {
            return res.status(403).json({ 
                error: 'You do not have access to this project',
                type: 'access_denied'
            });
        }

        return res.status(200).json({
            project
        });

    } catch (err) {
        console.error('Get project by ID error:', err);
        
        if (err.message === 'Project not found') {
            return res.status(404).json({ error: err.message });
        }
        
        res.status(400).json({ error: err.message });
    }
};

/**
 * Update file tree
 * FIXED: Validates membership and passes userId
 */
export const updateFileTree = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            errors: errors.array(),
            message: errors.array()[0].msg 
        });
    }

    try {
        const { projectId, fileTree } = req.body;

        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const project = await projectService.updateFileTree({
            projectId,
            fileTree,
            userId: loggedInUser._id
        });

        return res.status(200).json({
            project,
            message: 'File tree updated successfully'
        });

    } catch (err) {
        console.error('Update file tree error:', err);
        
        if (err.message.includes('not a member')) {
            return res.status(403).json({ 
                error: err.message,
                type: 'permission_denied'
            });
        }
        
        res.status(400).json({ error: err.message });
    }
};

/**
 * Search users by email for adding collaborators
 * FIXED: Excludes owner and existing members correctly
 */
export const searchUsersByEmail = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { email } = req.query;
        
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get the project with populated fields
        const project = await projectModel
            .findById(projectId)
            .populate('owner', 'email')
            .populate('users', 'email');

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Verify user is a member
        if (!project.isMember(loggedInUser._id)) {
            return res.status(403).json({ 
                error: 'You do not have access to this project',
                type: 'access_denied'
            });
        }

        // Get all existing member IDs (including owner)
        const existingMemberIds = project.users.map(user => user._id.toString());

        // Build search query
        let searchQuery = {
            _id: { $nin: existingMemberIds }
        };

        // Add email filter if provided
        if (email && email.trim()) {
            searchQuery.email = { 
                $regex: email.trim(), 
                $options: 'i'
            };
        }

        // Search users
        const users = await userModel
            .find(searchQuery)
            .select('email')
            .limit(10);

        return res.status(200).json({
            users: users,
            count: users.length
        });

    } catch (err) {
        console.error('Search users error:', err);
        res.status(400).json({ error: err.message });
    }
};

/**
 * Delete project
 * FIXED: Strict ownership validation
 */
export const deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const deletedProject = await projectService.deleteProject({
            projectId,
            userId: loggedInUser._id
        });

        return res.status(200).json({
            message: 'Project deleted successfully',
            project: deletedProject
        });

    } catch (err) {
        console.error('Delete project error:', err);
        
        if (err.message.includes('Only the project owner')) {
            return res.status(403).json({ 
                error: err.message,
                type: 'permission_denied'
            });
        }
        
        if (err.message === 'Project not found') {
            return res.status(404).json({ error: err.message });
        }
        
        res.status(400).json({ error: err.message });
    }
};

/**
 * Remove user from project
 * NEW: Allows owner to remove members or users to leave
 */
export const removeUserFromProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            errors: errors.array(),
            message: errors.array()[0].msg 
        });
    }

    try {
        const { projectId, userIdToRemove } = req.body;

        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const project = await projectService.removeUserFromProject({
            projectId,
            userIdToRemove,
            requestingUserId: loggedInUser._id
        });

        return res.status(200).json({
            project,
            message: 'User removed successfully'
        });

    } catch (err) {
        console.error('Remove user error:', err);
        
        if (err.message.includes('permission')) {
            return res.status(403).json({ 
                error: err.message,
                type: 'permission_denied'
            });
        }
        
        res.status(400).json({ error: err.message });
    }
};
