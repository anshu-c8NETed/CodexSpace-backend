import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        lowercase: true,
        required: true,
        trim: true,
        unique: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        immutable: true
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }],
    fileTree: {
        type: Object,
        default: {}
    },
}, {
    timestamps: true
});

projectSchema.index({ name: 1 }, { unique: true });
projectSchema.index({ owner: 1 });
projectSchema.index({ users: 1 });

projectSchema.methods.isOwner = function(userId) {
    return this.owner.toString() === userId.toString();
};

// FIXED: Include owner in membership check
projectSchema.methods.isMember = function(userId) {
    // Check if user is owner OR in users array
    const isOwner = this.owner.toString() === userId.toString();
    const isInUsers = this.users.some(user => user.toString() === userId.toString());
    return isOwner || isInUsers;
};

const Project = mongoose.model('project', projectSchema);

export default Project;
