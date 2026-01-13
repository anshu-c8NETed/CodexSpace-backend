import projectModel from '../models/project.model.js';
import * as projectService from '../services/project.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';


export const createProject = async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { name } = req.body;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const userId = loggedInUser._id;

        const newProject = await projectService.createProject({ name, userId });

        res.status(201).json(newProject);

    } catch (err) {
        console.log(err);
        
        // Send user-friendly error message
        if (err.message.includes('already exists')) {
            return res.status(400).json({ 
                error: err.message,
                type: 'duplicate_name'
            });
        }
        
        res.status(400).json({ 
            error: err.message || 'Failed to create workspace'
        });
    }



}

export const getAllProject = async (req, res) => {
    try {

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })

        const allUserProjects = await projectService.getAllProjectByUserId({
            userId: loggedInUser._id
        })

        return res.status(200).json({
            projects: allUserProjects
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
}

export const addUserToProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, users } = req.body

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })


        const project = await projectService.addUsersToProject({
            projectId,
            users,
            userId: loggedInUser._id
        })

        return res.status(200).json({
            project,
            message: 'Users added successfully'
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }


}

export const getProjectById = async (req, res) => {

    const { projectId } = req.params;

    try {

        const project = await projectService.getProjectById({ projectId });

        return res.status(200).json({
            project
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }

}

export const updateFileTree = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, fileTree } = req.body;

        const project = await projectService.updateFileTree({
            projectId,
            fileTree
        })

        return res.status(200).json({
            project
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }

}

// Get available users for direct addition (excluding current team members)
export const getAvailableUsersForProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get the project with team members
        const project = await projectModel.findById(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get team member IDs
        const teamMemberIds = project.users.map(userId => userId.toString());

        // Exclude: current user and team members
        const excludedIds = [
            loggedInUser._id.toString(),
            ...teamMemberIds
        ];

        // Get available users
        const availableUsers = await userModel.find({
            _id: { $nin: excludedIds }
        }).select('email');

        return res.status(200).json({
            users: availableUsers
        });

    } catch (err) {
        console.log('Error getting available users:', err);
        res.status(400).json({ error: err.message });
    }
}

// NEW: Search users by email (for adding collaborators)
export const searchUsersByEmail = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { email } = req.query;
        
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get the project with team members
        const project = await projectModel.findById(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get team member IDs
        const teamMemberIds = project.users.map(userId => userId.toString());

        // Exclude: current user and team members
        const excludedIds = [
            loggedInUser._id.toString(),
            ...teamMemberIds
        ];

        // Build search query
        let searchQuery = {
            _id: { $nin: excludedIds }
        };

        // If email search parameter provided, add email filter
        if (email && email.trim()) {
            searchQuery.email = { 
                $regex: email.trim(), 
                $options: 'i' // case-insensitive
            };
        }

        // Search users
        const users = await userModel.find(searchQuery)
            .select('email')
            .limit(10); // Limit results to 10

        return res.status(200).json({
            users: users,
            count: users.length
        });

    } catch (err) {
        console.log('Error searching users:', err);
        res.status(400).json({ error: err.message });
    }
}

// NEW: Delete project
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
        console.log('Error deleting project:', err);
        res.status(400).json({ error: err.message });
    }
}
