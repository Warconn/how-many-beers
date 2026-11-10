'use client';
import {createContext,useContext} from 'react';
const RecipeFirstContext=createContext(true);
export const RecipeFirstProvider=RecipeFirstContext.Provider;
export const useRecipeFirst=()=>useContext(RecipeFirstContext);
