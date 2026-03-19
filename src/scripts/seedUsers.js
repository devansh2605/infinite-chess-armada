const bcrypt = require('bcryptjs');
const User = require('../server/models/User');
const { pgp } = require('../server/models/database');
const logger = require('../server/logger');

const TEST_PASSWORD = 'password123';

const testUsers = [
	{ username: 'testuser1', email: 'test1@example.com' },
	{ username: 'testuser2', email: 'test2@example.com' },
	{ username: 'testuser3', email: 'test3@example.com' },
	{ username: 'testuser4', email: 'test4@example.com' },
];

(async function seedUsers() {
	try {
		const hash = bcrypt.hashSync(TEST_PASSWORD, 10);
		for (const u of testUsers) {
			try {
				const user = new User(undefined, u.username, u.email, hash);
				const id = await user.insert();
				logger.log(`Created user "${u.username}" with id ${id}`);
			} catch (err) {
				logger.log(`User "${u.username}" may already exist, skipping`);
			}
		}
		logger.log('Seed complete. All test users have password: password123');
	} catch (err) {
		logger.error(`Error seeding users: ${err}`);
	} finally {
		pgp.end();
	}
}());
