"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const config_1 = require("../config/config");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Sign up
router.post('/signup', (req, res) => {
    console.log('Signup request received:', req.body);
    const { username, password } = req.body;
    // Check if user already exists
    User_1.UserModel.findOne({ username }, (err, existingUser) => {
        if (err) {
            console.error('Error checking existing user:', err);
            return res.status(400).json({ message: 'Error checking user' });
        }
        if (existingUser) {
            console.log('Username already exists:', username);
            return res.status(400).json({ message: 'Username already exists' });
        }
        // Create new user
        User_1.UserModel.create({ username, password, chips: config_1.config.initialChips }, (err, user) => {
            if (err) {
                console.error('Error creating user:', err);
                return res.status(400).json({ message: 'Error creating user' });
            }
            if (!user) {
                console.error('No user returned after creation');
                return res.status(400).json({ message: 'Error creating user' });
            }
            console.log('User created successfully:', { id: user.id, username: user.username });
            // Generate token
            const token = jsonwebtoken_1.default.sign({ id: user.id }, config_1.config.jwtSecret, { expiresIn: '24h' });
            res.status(201).json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    chips: user.chips
                }
            });
        });
    });
});
// Sign in
router.post('/signin', (req, res) => {
    console.log('Signin request received:', req.body);
    const { username, password } = req.body;
    if (!username || !password) {
        console.log('Missing username or password');
        return res.status(400).json({ message: 'Username and password are required' });
    }
    // Find user
    User_1.UserModel.findOne({ username }, (err, user) => {
        if (err) {
            console.error('Error finding user:', err);
            return res.status(400).json({ message: 'Error finding user' });
        }
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        console.log('User found, comparing password');
        // Check password
        User_1.UserModel.comparePassword(user, password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing password:', err);
                return res.status(400).json({ message: 'Error checking password' });
            }
            if (!isMatch) {
                console.log('Password mismatch for user:', username);
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            console.log('Password matched, generating token');
            // Generate token
            const token = jsonwebtoken_1.default.sign({ id: user.id }, config_1.config.jwtSecret, { expiresIn: '24h' });
            console.log('Token generated, sending response');
            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    chips: user.chips
                }
            });
        });
    });
});
// Verify token
router.get('/verify', auth_1.auth, (req, res) => {
    try {
        const user = req.user;
        console.log('Token verified for user:', user.username);
        res.json({
            user: {
                id: user.id,
                username: user.username,
                chips: user.chips
            }
        });
    }
    catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
});
exports.default = router;
