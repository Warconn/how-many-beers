'use client';
import Home from '../page';
import {RecipeFirstProvider} from '@/components/RecipeFirstContext';
/** Opt-in flow review only: the accepted homepage, recipe storage and database stay unchanged. */
export default function RecipeFirstPreview(){return <RecipeFirstProvider value={true}><Home/></RecipeFirstProvider>;}
