import { Router } from 'express';
import { requireAuth, requireOrgAdmin } from '../middleware/auth';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController';

const categoryRouter = Router();
categoryRouter.use(requireAuth, requireOrgAdmin);
categoryRouter.get('/', listCategories);
categoryRouter.post('/', createCategory);
categoryRouter.get('/:categoryId', getCategory);
categoryRouter.patch('/:categoryId', updateCategory);
categoryRouter.delete('/:categoryId', deleteCategory);

export default categoryRouter;