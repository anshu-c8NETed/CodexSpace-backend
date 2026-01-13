import Invitation from '../models/invitation.model.js';
import projectModel from '../models/project.model.js';
import mongoose from 'mongoose';

export const createInvitation = async ({ projectId, senderId, recipientId }) => {
    if (!projectId || !senderId || !recipientId) {
        throw new Error('Project ID, sender ID, and recipient ID are required');
    }

    if (!mongoose.Types.ObjectId.isValid(projectId) || 
        !mongoose.Types.ObjectId.isValid(senderId) || 
        !mongoose.Types.ObjectId.isValid(recipientId)) {
        throw new Error('Invalid ID format');
    }

    if (senderId.toString() === recipientId.toString()) {
        throw new Error('You cannot invite yourself');
    }

    const project = await projectModel.findOne({
        _id: projectId,
        users: senderId
    });

    if (!project) {
        throw new Error('Project not found or user not authorized');
    }

    const isAlreadyMember = project.users.some(userId => 
        userId.toString() === recipientId.toString()
    );

    if (isAlreadyMember) {
        throw new Error('User is already a member of this project');
    }

    const existingInvitation = await Invitation.findOne({
        project: projectId,  // ✅ CORRECT field name
        recipient: recipientId,  // ✅ CORRECT field name
        status: 'pending'
    });

    if (existingInvitation) {
        throw new Error('An invitation is already pending for this user');
    }

    try {
        // ✅ FIXED: Use correct field names from model
        const invitation = await Invitation.create({
            project: projectId,      // Not 'projectId'
            sender: senderId,        // Not 'senderId'
            recipient: recipientId,  // Not 'recipientId'
            status: 'pending'
        });

        await invitation.populate([
            { path: 'project', select: 'name' },
            { path: 'sender', select: 'email' },
            { path: 'recipient', select: 'email' }
        ]);

        return invitation;
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('An invitation already exists for this user');
        }
        throw error;
    }
};

export const getPendingInvitations = async ({ userId }) => {
    if (!userId) {
        throw new Error('User ID is required');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
    }

    const invitations = await Invitation.find({
        recipient: userId,
        status: 'pending'
    })
    .populate('project', 'name')
    .populate('sender', 'email')
    .sort({ createdAt: -1 });

    return invitations;
};

export const acceptInvitation = async ({ invitationId, userId }) => {
    if (!invitationId || !userId) {
        throw new Error('Invitation ID and user ID are required');
    }

    if (!mongoose.Types.ObjectId.isValid(invitationId) || 
        !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid ID format');
    }

    const invitation = await Invitation.findOne({
        _id: invitationId,
        recipient: userId,
        status: 'pending'
    });

    if (!invitation) {
        throw new Error('Invitation not found or already processed');
    }

    invitation.status = 'accepted';
    await invitation.save();

    const project = await projectModel.findByIdAndUpdate(
        invitation.project,
        { $addToSet: { users: userId } },
        { new: true }
    ).populate('users', 'email');

    if (!project) {
        throw new Error('Project not found');
    }

    await invitation.populate([
        { path: 'project', select: 'name' },
        { path: 'sender', select: 'email' }
    ]);

    return { invitation, project };
};

export const rejectInvitation = async ({ invitationId, userId }) => {
    if (!invitationId || !userId) {
        throw new Error('Invitation ID and user ID are required');
    }

    if (!mongoose.Types.ObjectId.isValid(invitationId) || 
        !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid ID format');
    }

    const invitation = await Invitation.findOne({
        _id: invitationId,
        recipient: userId,
        status: 'pending'
    });

    if (!invitation) {
        throw new Error('Invitation not found or already processed');
    }

    invitation.status = 'rejected';
    await invitation.save();

    await invitation.populate([
        { path: 'project', select: 'name' },
        { path: 'sender', select: 'email' }
    ]);

    return invitation;
};

export const getSentInvitations = async ({ projectId, userId }) => {
    if (!projectId || !userId) {
        throw new Error('Project ID and user ID are required');
    }

    if (!mongoose.Types.ObjectId.isValid(projectId) || 
        !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid ID format');
    }

    const project = await projectModel.findOne({
        _id: projectId,
        users: userId
    });

    if (!project) {
        throw new Error('Project not found or user not authorized');
    }

    const invitations = await Invitation.find({
        project: projectId,
        status: 'pending'
    })
    .populate('recipient', 'email')
    .populate('sender', 'email')
    .sort({ createdAt: -1 });

    return invitations;
};
