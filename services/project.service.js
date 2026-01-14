import projectModel from '../models/project.model.js';
import mongoose from 'mongoose';

export const createProject = async ({ name, userId }) => {
    if (!name) {
        throw new Error('Name is required');
    }
    if (!userId) {
        throw new Error('UserId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid userId');
    }

    const sanitizedName = name.toLowerCase().trim();
    
    if (sanitizedName.length < 3) {
        throw new Error('Workspace name must be at least 3 characters long');
    }

    if (sanitizedName.length > 50) {
        throw new Error('Workspace name must not exceed 50 characters');
    }

    const existingProject = await projectModel.findOne({ name: sanitizedName });
    if (existingProject) {
        throw new Error('A workspace with this name already exists. Please choose a different name.');
    }

    let project;
    try {
        project = await projectModel.create({
            name: sanitizedName,
            owner: userId,
            users: [userId]
        });

        await project.populate([
            { path: 'owner', select: 'email' },
            { path: 'users', select: 'email' }
        ]);

    } catch (error) {
        if (error.code === 11000) {
            throw new Error('A workspace with this name already exists. Please choose a different name.');
        }
        throw error;
    }

    return project;
};

export const getAllProjectByUserId = async ({ userId }) => {
    if (!userId) {
        throw new Error('UserId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid userId');
    }

    const allUserProjects = await projectModel
        .find({
            users: userId
        })
        .populate('owner', 'email')
        .populate('users', 'email')
        .sort({ createdAt: -1 });

    return allUserProjects;
};

export const addUsersToProject = async ({ projectId, users, userId }) => {
    if (!projectId) {
        throw new Error('projectId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error('Invalid projectId');
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
        throw new Error('users array is required and must not be empty');
    }

    if (users.some(uid => !mongoose.Types.ObjectId.isValid(uid))) {
        throw new Error('Invalid userId(s) in users array');
    }

    if (!userId) {
        throw new Error('userId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid userId');
    }

    const project = await projectModel.findById(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    if (project.owner.toString() !== userId.toString()) {
        throw new Error('Only the project owner can add collaborators');
    }

    const existingUserIds = project.users.map(id => id.toString());
    const newUsers = users.filter(uid => !existingUserIds.includes(uid.toString()));

    if (newUsers.length === 0) {
        throw new Error('All selected users are already members of this project');
    }

    const updatedProject = await projectModel
        .findByIdAndUpdate(
            projectId,
            {
                $addToSet: {
                    users: { $each: newUsers }
                }
            },
            { new: true }
        )
        .populate('owner', 'email')
        .populate('users', 'email');

    return updatedProject;
};

export const getProjectById = async ({ projectId }) => {
    if (!projectId) {
        throw new Error('projectId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error('Invalid projectId');
    }

    const project = await projectModel
        .findById(projectId)
        .populate('owner', 'email')
        .populate('users', 'email');

    if (!project) {
        throw new Error('Project not found');
    }

    return project;
};

export const updateFileTree = async ({ projectId, fileTree, userId }) => {
    if (!projectId) {
        throw new Error('projectId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error('Invalid projectId');
    }

    if (!fileTree) {
        throw new Error('fileTree is required');
    }

    if (!userId) {
        throw new Error('userId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid userId');
    }

    const project = await projectModel.findById(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    if (!project.isMember(userId)) {
        throw new Error('You are not a member of this project');
    }

    const updatedProject = await projectModel
        .findByIdAndUpdate(
            projectId,
            { fileTree },
            { new: true }
        )
        .populate('owner', 'email')
        .populate('users', 'email');

    return updatedProject;
};

export const deleteProject = async ({ projectId, userId }) => {
    if (!projectId) {
        throw new Error('projectId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error('Invalid projectId');
    }

    if (!userId) {
        throw new Error('userId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid userId');
    }

    const project = await projectModel.findById(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    if (!project.isOwner(userId)) {
        throw new Error('Only the project owner can delete this workspace');
    }

    const deletedProject = await projectModel.findByIdAndDelete(projectId);

    return deletedProject;
};

export const removeUserFromProject = async ({ projectId, userIdToRemove, requestingUserId }) => {
    if (!projectId || !userIdToRemove || !requestingUserId) {
        throw new Error('projectId, userIdToRemove, and requestingUserId are required');
    }

    if (!mongoose.Types.ObjectId.isValid(projectId) || 
        !mongoose.Types.ObjectId.isValid(userIdToRemove) ||
        !mongoose.Types.ObjectId.isValid(requestingUserId)) {
        throw new Error('Invalid ID format');
    }

    const project = await projectModel.findById(projectId);

    if (!project) {
        throw new Error('Project not found');
    }

    const isOwner = project.isOwner(requestingUserId);
    const isSelfRemoval = requestingUserId.toString() === userIdToRemove.toString();

    if (project.isOwner(userIdToRemove)) {
        throw new Error('Project owner cannot be removed. Delete the project instead.');
    }

    if (!isOwner && !isSelfRemoval) {
        throw new Error('Only the project owner can remove other members');
    }

    const updatedProject = await projectModel
        .findByIdAndUpdate(
            projectId,
            {
                $pull: { users: userIdToRemove }
            },
            { new: true }
        )
        .populate('owner', 'email')
        .populate('users', 'email');

    return updatedProject;
};

export default {
    createProject,
    getAllProjectByUserId,
    addUsersToProject,
    getProjectById,
    updateFileTree,
    deleteProject,
    removeUserFromProject
};
