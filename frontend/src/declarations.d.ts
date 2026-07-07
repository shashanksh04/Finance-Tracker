declare module '@hookform/resolvers/zod' {
  import { FieldErrors, Resolver } from 'react-hook-form';
  import { z } from 'zod';
  export function zodResolver<T extends z.ZodType>(
    schema: T,
    resolverOptions?: { mode?: 'sync' | 'async'; raw?: boolean }
  ): Resolver<z.infer<T>>;
}
