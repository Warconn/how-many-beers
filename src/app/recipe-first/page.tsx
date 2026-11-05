'use client';
import Home from '../page';
import {RecipeFirstProvider} from '@/components/RecipeFirstContext';
/** Isolated review route. The accepted homepage stays unchanged until approval. */
export default function RecipeFirstPreview(){return <RecipeFirstProvider value={true}><Home/></RecipeFirstProvider>;}
