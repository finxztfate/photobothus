/**
 * Host (customer) event pages — routes under /events/*
 *
 * | Route                                | File                 |
 * |--------------------------------------|----------------------|
 * | /events                              | EventHostListPage    |
 * | /events/new                          | EventHostCreatePage  |
 * | /events/:id                          | EventHostDetailPage  |
 * | /events/:id/edit                     | EventHostEditPage    |
 * | /events/:id/strips/:stripId/edit     | EventEditor          |
 *
 * Guest flow lives under /e/:code/* (see pages/events/guest).
 */
export { default as EventHostListPage } from './EventHostListPage';
export { default as EventHostDetailPage } from './EventHostDetailPage';
export { default as EventHostCreatePage } from './EventHostCreatePage';
export { default as EventHostEditPage } from './EventHostEditPage';
export { default as EventEditor } from './EventEditor';
