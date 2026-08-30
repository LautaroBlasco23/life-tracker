// Shared business layer for the web and mobile clients.
// Granular imports (@shared/services/*, @shared/types, ...) are also valid.
export * from './services/auth-service';
export * from './services/activity-service';
export * from './services/note-service';
export * from './services/routine-service';
export * from './services/time-service';
export * from './services/user-service';
export * from './services/finance-service';
export * from './services/health-service';
export * from './services/social-service';
export * from './types';
export * from './lib/config';
export * from './lib/storage';
export * from './lib/theme-colors';
export * from './utils/translateEnums';
export * from './utils/format';
export * from './contexts/language-context';
