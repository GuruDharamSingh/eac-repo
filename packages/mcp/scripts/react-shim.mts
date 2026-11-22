// The page store pulls in the block catalogue, whose JSX is classic-transformed under tsx: it needs a global React.
// Imported first by harness.mts so it runs before the store loads. Test and serve scripts only.
import React from '../../page-builder/node_modules/react';
(globalThis as unknown as { React: unknown }).React = React;
