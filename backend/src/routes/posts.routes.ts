import { Router } from 'express';
import { listPosts, getPost, createPost, updatePost, removePost } from '../controllers/posts.controller';
import { validatePost } from '../middleware/validatePost';

const router = Router();

router.get('/', listPosts);
router.get('/:id', getPost);
router.post('/', validatePost, createPost);
router.put('/:id', validatePost, updatePost);
router.delete('/:id', removePost);

export default router;
