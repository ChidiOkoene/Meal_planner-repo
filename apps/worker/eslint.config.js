import shared from '@dyjext/config/eslint';

// test-fixtures holds small plain-JS helper processes started by tests; not type-checked.
export default [{ ignores: ['test-fixtures/**'] }, ...shared];
