require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');

const User = require('./models/User');

const app = express();

// ✅ Database
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB Connected"));

// ✅ Trust Render proxy for cookies
app.set('trust proxy', 1);

// ✅ Session config with secure cookies
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    secure: true,      // 🔒 HTTPS only
    sameSite: 'lax'    // ✅ Needed for Google OAuth flow
  }
}));

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    user = await User.create({
      googleId: profile.id,
      username: profile.displayName,
      profilePic: profile.photos[0].value
    });
  }
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// ✅ Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    console.log("✅ Logged in:", req.user?.username);
    res.redirect('/feed.html');
  }
);

// ✅ Check current user
app.get('/api/me', (req, res) => {
  if (req.isAuthenticated()) return res.json(req.user);
  res.status(401).json({ error: 'Not authenticated' });
});

// ✅ Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 CLIQUE running on port ${PORT}`));
