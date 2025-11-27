import { z } from 'zod';

class AuthValidation {
  register = {
    body: z.object({
      name: z
        .string({ message: 'Name is required' })
        .min(2, { message: 'Name must contain at least 2 characters' })
        .max(150, { message: 'Name must not exceed 150 characters' })
        .trim(),
      email: z
        .string({ message: 'Email is required' })
        .email({ message: 'Email must be a valid email address' })
        .toLowerCase()
        .trim(),
      password: z
        .string({ message: 'Password is required' })
        .min(8, { message: 'Password must be at least 8 characters' })
        .max(50, { message: 'Password must not exceed 50 characters' }),
    }),
  };

  login = {
    body: z.object({
      email: z
        .string({ message: 'Email is required' })
        .email({ message: 'Email must be a valid email address' })
        .toLowerCase()
        .trim(),
      password: z
        .string({ message: 'Password is required' })
        .min(1, { message: 'Password is required' }),
    }),
  };
}

export default new AuthValidation();
