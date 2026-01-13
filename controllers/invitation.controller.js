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
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        const invitation = await invitationService.createInvitation({
            projectId,
            senderId: loggedInUser._id,
            recipientId
        });

        return res.status(201).json({
            invitation,
            message: 'Invitation sent successfully'
        });

    } catch (err) {
        console.log(err);
        res.status(400).json({ error: err.message });
    }
};

export const getPendingInvitations = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        const invitations = await invitationService.getPendingInvitations({
            userId: loggedInUser._id
        });

        return res.status(200).json({
            invitations
        });

    } catch (err) {
        console.log(err);
        res.status(400).json({ error: err.message });
    }
};

export const acceptInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        const result = await invitationService.acceptInvitation({
            invitationId,
            userId: loggedInUser._id
        });

        return res.status(200).json({
            project: result.project,
            invitation: result.invitation,
            message: 'Invitation accepted successfully'
        });

    } catch (err) {
        console.log(err);
        res.status(400).json({ error: err.message });
    }
};

export const rejectInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        const invitation = await invitationService.rejectInvitation({
            invitationId,
            userId: loggedInUser._id
        });

        return res.status(200).json({
            invitation,
            message: 'Invitation rejected'
        });

    } catch (err) {
        console.log(err);
        res.status(400).json({ error: err.message });
    }
};

export const getSentInvitations = async (req, res) => {
    try {
        const { projectId } = req.params;
        const loggedInUser = await userModel.findOne({ email: req.user.email });

        const invitations = await invitationService.getSentInvitations({
            projectId,
            userId: loggedInUser._id
        });

        return res.status(200).json({
            invitations
        });

    } catch (err) {
        console.log(err);
        res.status(400).json({ error: err.message });
    }
};