'use client';
import {createContext,useContext} from 'react';
const RecipeFirstContext=createContext(false);
export const RecipeFirstProvider=RecipeFirstContext.Provider;
export const useRecipeFirst=()=>useContext(RecipeFirstContext);
