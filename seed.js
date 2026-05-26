const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');

dotenv.config();

mongoose.connect(process.env.MONGO_URI);

const seedData = async () => {
    try {
        // Clear existing users
        await User.deleteMany();

        // Create Admin
        await User.create({
            name: 'System Admin',
            email: 'admin@medilife.com',
            password: 'admin123', // Will be hashed by the User model pre-save hook
            role: 'admin'
        });

        await Doctor.collection.dropIndex('doctorId_1').catch(() => {});
        await Patient.collection.dropIndex('username_1').catch(() => {});
        await Patient.collection.dropIndex('patientId_1').catch(() => {});
        await Doctor.deleteMany();
        await Doctor.insertMany([
            {
                fullName: 'Dr. Sarah Fernando',
                email: 'sarah.fernando@medilife.com',
                phone: '011-555-1030',
                specialization: 'Cardiologist',
                department: 'Cardiology',
                availability: '09:00 AM - 03:00 PM'
            },
            {
                fullName: 'Dr. Nimal Perera',
                email: 'nimal.perera@medilife.com',
                phone: '011-555-1040',
                specialization: 'General Physician',
                department: 'General Medicine',
                availability: '10:00 AM - 05:00 PM'
            },
            {
                fullName: 'Dr. Asha Silva',
                email: 'asha.silva@medilife.com',
                phone: '011-555-1050',
                specialization: 'Neurologist',
                department: 'Neurology',
                availability: '09:00 AM - 01:00 PM'
            }
        ]);

        console.log('Database Seeded! Admin Login: admin@medilife.com / admin123');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
