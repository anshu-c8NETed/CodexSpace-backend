import mongoose from 'mongoose';


const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        lowercase: true,
        required: true,
        trim: true,
        unique: true, // Keep unique constraint
    },

    users: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        }
    ],
    fileTree: {
        type: Object,
        default: {}
    },

})

// Add index for better error handling
projectSchema.index({ name: 1 }, { unique: true });

const Project = mongoose.model('project', projectSchema)


export default Project;
