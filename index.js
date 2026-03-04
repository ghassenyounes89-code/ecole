const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ==================== تعديل CORS ليسمح بـ Netlify ====================
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000',
    'https://ecolesmart.netlify.app'  // تم إضافة رابط Netlify
  ],
  credentials: true
}));
app.use(express.json());

// ==================== CONNEXION MONGODB ATLAS ====================
const MONGODB_URI = 'mongodb+srv://ecole:ecole123@cluster0.0vlvpwb.mongodb.net/smartschool?retryWrites=true&w=majority';

// الإصدار الجديد من Mongoose - بدون خيارات إضافية
mongoose.connect(MONGODB_URI)
.then(() => {
  console.log('✅ Connecté à MongoDB Atlas');
  createDefaultAdmin();
  seedDatabase();
})
.catch(err => {
  console.error('❌ Erreur de connexion MongoDB:', err.message);
});

// ==================== SCHÉMAS ====================
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  titleAr: { type: String, required: true },
  description: { type: String, required: true },
  features: [String],
  price: String,
  image: { type: String, required: true },
  icon: { type: String, default: 'graduation' },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['waiting', 'confirmed'], default: 'waiting' },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }
});

const Course = mongoose.model('Course', courseSchema);
const Message = mongoose.model('Message', messageSchema);
const User = mongoose.model('User', userSchema);

// ==================== FONCTIONS ====================
async function createDefaultAdmin() {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await new User({ username: 'admin', password: hashedPassword }).save();
      console.log('✅ Admin créé: admin / admin123');
    } else {
      console.log('✅ Admin déjà existant');
    }
  } catch (error) {
    console.error('Erreur création admin:', error);
  }
}

async function seedDatabase() {
  try {
    const coursesCount = await Course.countDocuments();
    if (coursesCount === 0) {
      await Course.insertMany([
        {
          title: "Préparation IELTS",
          titleAr: "تحضير امتحان IELTS",
          description: "Programme intensif de préparation à l'examen IELTS avec des enseignants certifiés.",
          features: [
            "40 heures de formation intensive",
            "Listening, Speaking, Reading & Writing",
            "Tests blancs et simulations d'examen",
            "Matériel pédagogique inclus"
          ],
          price: "17,000 DA",
          image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
          icon: "graduation"
        },
        {
          title: "Pack Informatique",
          titleAr: "حزمة المعلوماتية",
          description: "Maîtrisez les outils bureautiques essentiels pour votre carrière professionnelle.",
          features: [
            "Word avancé (mise en page professionnelle)",
            "Excel (formules, tableaux croisés dynamiques)",
            "PowerPoint & Canva (présentations créatives)",
            "Gestion de Windows et maintenance"
          ],
          price: "",
          image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
          icon: "monitor"
        },
        {
          title: "Langues & Soutien Scolaire",
          titleAr: "اللغات والدعم المدرسي",
          description: "Apprenez le français et l'anglais ou bénéficiez d'un soutien scolaire personnalisé.",
          features: [
            "Français (DELF/DALF) - tous niveaux",
            "Anglais pour enfants, adolescents et adultes",
            "Soutien scolaire toutes matières",
            "Classes en petits groupes"
          ],
          price: "",
          image: "https://images.unsplash.com/photo-1543269664-7eef42226a21?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
          icon: "languages"
        }
      ]);
      console.log('✅ Formations par défaut ajoutées');
    }
  } catch (error) {
    console.error('Erreur seed database:', error);
  }
}

// Middleware vérification token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Non autorisé' });
  try {
    const decoded = jwt.verify(token, 'SECRET_KEY_SMART_SCHOOL_2024');
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalide' });
  }
};

// ==================== ROUTES ====================

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'API Smart School fonctionne!' });
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Tentative de connexion:', username);
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }
    
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      'SECRET_KEY_SMART_SCHOOL_2024',
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token, 
      user: { id: user._id, username: user.username } 
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Courses (public)
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    console.error('Erreur get courses:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Courses (protégé)
app.post('/api/courses', verifyToken, async (req, res) => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (error) {
    console.error('Erreur add course:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.put('/api/courses/:id', verifyToken, async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(course);
  } catch (error) {
    console.error('Erreur update course:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.delete('/api/courses/:id', verifyToken, async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Formation supprimée' });
  } catch (error) {
    console.error('Erreur delete course:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Messages (public)
app.post('/api/messages', async (req, res) => {
  try {
    const message = new Message(req.body);
    await message.save();
    res.status(201).json({ 
      message: 'Message envoyé avec succès',
      data: message 
    });
  } catch (error) {
    console.error('Erreur add message:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Messages (protégé)
app.get('/api/messages', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    console.error('Erreur get messages:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.patch('/api/messages/:id/status', verifyToken, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(message);
  } catch (error) {
    console.error('Erreur update message status:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.delete('/api/messages/:id', verifyToken, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: 'Message supprimé' });
  } catch (error) {
    console.error('Erreur delete message:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
  try {
    const stats = {
      totalCourses: await Course.countDocuments(),
      totalMessages: await Message.countDocuments(),
      waitingMessages: await Message.countDocuments({ status: 'waiting' }),
      confirmedMessages: await Message.countDocuments({ status: 'confirmed' })
    };
    
    const recentMessages = await Message.find()
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({ stats, recentMessages });
  } catch (error) {
    console.error('Erreur get stats:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================== DÉMARRAGE ====================
const PORT = process.env.PORT || 5000; // تعديل مهم لـ Render
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📝 Routes disponibles:`);
  console.log(`   - GET  /`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - GET  /api/courses`);
  console.log(`   - POST /api/courses (protégé)`);
  console.log(`   - GET  /api/messages (protégé)`);
  console.log(`   - POST /api/messages (public)`);
  console.log(`   - GET  /api/dashboard/stats (protégé)`);
});