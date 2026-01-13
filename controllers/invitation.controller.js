import * as invitationService from '../services/invitation.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';

export const sendInvitation = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { projectId, recipientId } = req.body;
        
        console.log('📨 Sending invitation:', {
            projectId,
            recipientId,
            senderEmail: req.user.email
        });

        const loggedInUser = await userModel.findOne({ email: req.user.email });
        if (!loggedInUser) {
            console.error('❌ User not found:', req.user.email);
            return res.status(404).json({ error: 'User not found' });
        }

        const invitation = await invitationService.createInvitation({
            projectId,
            senderId: loggedInUser._id,
            recipientId
        });

        console.log('✅ Invitation created:', invitation._id);

        return res.status(201).json({
            invitation,
            message: 'Invitation sent successfully'
        });

    } catch (err) {
        console.error('❌ Error sending invitation:', err.message);
        res.status(400).json({ error: err.message });
    }
};

export const getPendingInvitations = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const invitations = await invitationService.getPendingInvitations({
            userId: loggedInUser._id
        });

        console.log(`✅ Found ${invitations.length} pending invitations`);

        return res.status(200).json({ invitations });

    } catch (err) {
        console.error('❌ Error fetching invitations:', err.message);
        res.status(400).json({ error: err.message });
    }
};

export const acceptInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await invitationService.acceptInvitation({
            invitationId,
            userId: loggedInUser._id
        });

        console.log('✅ Invitation accepted:', invitationId);

        return res.status(200).json({
            project: result.project,
            invitation: result.invitation,
            message: 'Invitation accepted successfully'
        });

    } catch (err) {
        console.error('❌ Error accepting invitation:', err.message);
        res.status(400).json({ error: err.message });
    }
};

export const rejectInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const invitation = await invitationService.rejectInvitation({
            invitationId,
            userId: loggedInUser._id
        });

        console.log('✅ Invitation rejected:', invitationId);

        return res.status(200).json({
            invitation,
            message: 'Invitation rejected'
        });

    } catch (err) {
        console.error('❌ Error rejecting invitation:', err.message);
        res.status(400).json({ error: err.message });
    }
};

export const getSentInvitations = async (req, res) => {
    try {
        const { projectId } = req.params;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        if (!loggedInUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const invitations = await invitationService.getSentInvitations({
            projectId,
            userId: loggedInUser._id
        });

        console.log(`✅ Found ${invitations.length} sent invitations for project ${projectId}`);

        return res.status(200).json({ invitations });

    } catch (err) {
        console.error('❌ Error fetching sent invitations:', err.message);
        res.status(400).json({ error: err.message });
    }
};
