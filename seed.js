const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');

dotenv.config();

const weekdaySlots = (startTime, endTime, slotDurationMin = 30) =>
    [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime, endTime, slotDurationMin }));

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        await User.deleteMany({ email: 'admin@medilife.com' });
        await User.create({
            name: 'System Admin',
            email: 'admin@medilife.com',
            password: 'admin123',
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
                availability: '09:00 - 15:00',
                availabilitySlots: weekdaySlots('09:00', '15:00', 30)
            },
            {
                fullName: 'Dr. Nimal Perera',
                email: 'nimal.perera@medilife.com',
                phone: '011-555-1040',
                specialization: 'General Physician',
                department: 'General Medicine',
                availability: '10:00 - 17:00',
                availabilitySlots: weekdaySlots('10:00', '17:00', 30)
            },
            {
                fullName: 'Dr. Asha Silva',
                email: 'asha.silva@medilife.com',
                phone: '011-555-1050',
                specialization: 'Neurologist',
                department: 'Neurology',
                availability: '09:00 - 13:00',
                availabilitySlots: weekdaySlots('09:00', '13:00', 30)
            }
        ]);

        console.log('Database seeded. Admin login: admin@medilife.com / admin123');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
