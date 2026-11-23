// Uso:
//   npx tsx src/scripts/set-role.ts roni@teste.com admin     -> muda o papel
//   npx tsx src/scripts/set-role.ts h@teste.com delete       -> apaga o usuário
import 'dotenv/config';
import mongoose from 'mongoose';

const ROLES = ['admin', 'fornecedor', 'motorista', 'recebedor'];
const [emailArg, action] = process.argv.slice(2);

if (!emailArg || !action || (action !== 'delete' && !ROLES.includes(action))) {
  console.error(`Uso: tsx src/scripts/set-role.ts <email> <${ROLES.join('|')}|delete>`);
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI não encontrada no .env');
  process.exit(1);
}

const email = emailArg.toLowerCase();

await mongoose.connect(process.env.MONGODB_URI);
const users = mongoose.connection.collection('users');

if (action === 'delete') {
  const r = await users.deleteOne({ email });
  console.log(r.deletedCount ? `🗑️  ${email} apagado` : `⚠️  ${email} não encontrado`);
} else {
  const r = await users.updateOne({ email }, { $set: { role: action } });
  console.log(r.matchedCount ? `✅ ${email} agora é "${action}"` : `⚠️  ${email} não encontrado`);
}

await mongoose.disconnect();
