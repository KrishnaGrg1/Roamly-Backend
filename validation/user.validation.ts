import z from 'zod';

class userValidations {
  editUser = {
    body: z.object({
      name: z
        .string({ message: 'Name must be a string' })
        .min(2, { message: 'Name must contain at least 2 characters' })
        .max(150, { message: 'Name must not exceed 150 characters' })
        .trim()
        .optional(),
    }),
  };
  userIdParam = {
    params: z.object({
      id: z
        .string({ message: 'User ID is required' })
        .uuid({ message: 'User ID must be a valid UUID' }),
    }),
  };
}

export default new userValidations();
