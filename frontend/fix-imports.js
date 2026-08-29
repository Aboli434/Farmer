const fs = require('fs');
const path = require('path');

const adminTypes = path.join(__dirname, 'src/types/admin.ts');
if (fs.existsSync(adminTypes)) {
  let content = fs.readFileSync(adminTypes, 'utf8');
  content = content.replace(/import \{ Product, ProductStatus \} from '\.\/product';\n/g, '');
  content = content.replace(/import \{ SellerOrder, OrderStatus, PaymentStatus, RefundStatus \} from '\.\/order';\n/g, "import { SellerOrder } from './order';\n");
  content = content.replace(/import \{ User, Role \} from '\.\/auth';\n/g, "import { User } from './auth';\n");
  fs.writeFileSync(adminTypes, content, 'utf8');
  console.log(`Updated admin.ts types`);
}
