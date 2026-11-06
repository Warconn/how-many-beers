import {redirect} from 'next/navigation';
/** Preserve old feature-review bookmarks; approved planning now lives at /. */
export default function RecipeFirstPreview(){redirect('/');}
