import { Router } from 'express';

import * as eventController from './event.controller';

const router = Router({ mergeParams: true }); // herda :chave do invoice.router
router.get('/', eventController.list);

export default router;
