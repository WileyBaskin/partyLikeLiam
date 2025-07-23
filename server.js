const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

currentPicDirectory = "";


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create directories if they don't exist
async function ensureDirectories() {
    const dirs = ['uploads', 'uploads/photos', 'data'];
    for (const dir of dirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.error(`Error creating directory ${dir}:`, error);
        }
    }
}

// File storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/photos/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        currentPicDirectory = file.originalname;
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
        }
    }
});

// Data file paths
const COMMENTS_FILE = path.join(__dirname, 'data', 'comments.json');
const GUESTS_FILE = path.join(__dirname, 'data', 'guests.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');


// Helper functions for data persistence
async function loadComments() {
    try {
        const data = await fs.readFile(COMMENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function saveComments(comments) {
    try {
        console.log('Saving to:', COMMENTS_FILE)
        await fs.writeFile(COMMENTS_FILE, JSON.stringify(comments, null, 2));
    } catch (error) {
        console.error('Error saving comments:', error);
        throw error;
    }
}

async function loadGuests() {
    try {
        const data = await fs.readFile(GUESTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function saveGuests(guests) {
    try {
        console.log('Saving to:', GUESTS_FILE)
        await fs.writeFile(GUESTS_FILE, JSON.stringify(guests, null, 2));
    } catch (error) {
        console.error('Error saving comments:', error);
        throw error;
    }
}

async function loadSettings() {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { groomPhotoUrl: null };
    }
}

async function saveSettings(settings) {
    try {
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}

// API Routes

// Get all comments
app.get('/api/comments', async (req, res) => {
    try {
        const comments = await loadComments();
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load comments' });
    }
});

// Add a new comment
app.post('/api/comments', async (req, res) => {
    //console.log("trying to save in server")
    try {
        const comment = req.body
        const { name, message } = comment.comment
        if (!name || !message) {
            return res.status(400).json({ error: 'Name and message are required' });
        }

        
            const date = new Date();
            const day = date.getDate();             // Day (1-31)
            const month = date.getMonth() + 1;      // Month (0-11, so +1)
            const year = date.getFullYear();        // Full year (e.g. 2025)
        
            const readableDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
        

        const comments = await loadComments();
        const newComment = {
            id: Date.now().toString(),
            name: name.trim(),
            message: message.trim(),
            time: readableDate,
            timestamp: Date.now()
        };

        comments.unshift(newComment); // Add to beginning of array
    
        await saveComments(comments);
        
        res.status(201).json(newComment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Get all guests
app.get('/api/guests', async (req, res) => {
    try {
        const guests = await loadGuests();
        res.json(guests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load comments' });
    }
});

// Add a new guest
app.post('/api/guests', upload.single('photo'), async (req, res) => {
    //console.log("trying to save in server")
    
    try {
        const guest = req.body
        const name = guest.name
        console.log("before name check");

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        console.log("before load guests");
        const guests = await loadGuests();
        console.log("before new guest");

        const newGuest = {
            id: guest.id,
            name: name.trim(),
            src: currentPicDirectory,
            photo: guest.photo
        };
        console.log("after new guest");

        guests.push(newGuest); // Add to beginning of array
    
        console.log("before save guest");

        await saveGuests(guests);
        
        res.status(201).json(newGuest);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add guest' });
    }
});

// Delete a comment (optional admin feature)
app.delete('/api/comments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await loadComments();
        const filteredComments = comments.filter(comment => comment.id !== id);
        
        if (filteredComments.length === comments.length) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        await saveComments(filteredComments);
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Upload groom photo
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const photoUrl = `/uploads/photos/${req.file.filename}`;
        const settings = await loadSettings();
        
        // Delete old photo if exists
        if (settings.groomPhotoUrl) {
            const oldPhotoPath = path.join(__dirname, 'uploads', 'photos', path.basename(settings.groomPhotoUrl));
            try {
                await fs.unlink(oldPhotoPath);
            } catch (error) {
                console.log('Old photo not found or already deleted');
            }
        }
        
        settings.groomPhotoUrl = photoUrl;
        await saveSettings(settings);
        
        res.json({ photoUrl });
    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// Get current groom photo
app.get('/api/groom-photo', async (req, res) => {
    try {
        const settings = await loadSettings();
        res.json({ photoUrl: settings.groomPhotoUrl });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get photo' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
    }
    res.status(500).json({ error: error.message });
});

// Initialize and start server
async function startServer() {
    await ensureDirectories();
    
    app.listen(PORT, () => {
        console.log(`🎉 Party backend server running on port ${PORT}`);
        console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
        console.log(`💾 Data directory: ${path.join(__dirname, 'data')}`);
    });
}

startServer().catch(console.error);