-- #114 additive personal recipes. Apply only after owner review; no cook data changes.
begin;
create function public.hmb_schema_matches(v jsonb,s jsonb,root jsonb,depth integer default 0) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; item jsonb; branch jsonb; typ text; matches integer; n numeric;
begin
 if depth>100 then return false; end if;
 if s ? '$ref' then return public.hmb_schema_matches(v,root#>string_to_array(substring(s->>'$ref' from 3),'/'),root,depth+1);end if;
 if s ? 'oneOf' then select count(*) into matches from jsonb_array_elements(s->'oneOf') b where public.hmb_schema_matches(v,b,root,depth+1);if matches<>1 then return false;end if;end if;
 if s ? 'anyOf' then if not exists(select 1 from jsonb_array_elements(s->'anyOf') b where public.hmb_schema_matches(v,b,root,depth+1)) then return false;end if;end if;
 if s ? 'const' and v is distinct from s->'const' then return false;end if;
 if s ? 'enum' and not exists(select 1 from jsonb_array_elements(s->'enum') e where e=v) then return false;end if;
 typ:=jsonb_typeof(v);
 if s ? 'type' then
  if jsonb_typeof(s->'type')='array' then
   if not exists(select 1 from jsonb_array_elements_text(s->'type') t where t=typ or (t='integer' and typ='number' and (v::text)::numeric=trunc((v::text)::numeric))) then return false;end if;
  elsif s->>'type'='integer' then if typ<>'number' or (v::text)::numeric<>trunc((v::text)::numeric) then return false;end if;
  elsif s->>'type'<>typ then return false;end if;
 end if;
 if typ='object' then
  if s ? 'required' and not v ?& array(select jsonb_array_elements_text(s->'required')) then return false;end if;
  if s ? 'maxProperties' and (select count(*) from jsonb_object_keys(v))>(s->>'maxProperties')::int then return false;end if;
  for k,item in select * from jsonb_each(v) loop
   if s ? 'propertyNames' and not public.hmb_schema_matches(to_jsonb(k),s->'propertyNames',root,depth+1) then return false;end if;
   if s->'properties' ? k then
    if not public.hmb_schema_matches(item,s->'properties'->k,root,depth+1) then return false;end if;
   elsif s->'additionalProperties'='false'::jsonb then return false;
   elsif jsonb_typeof(s->'additionalProperties')='object' then if not public.hmb_schema_matches(item,s->'additionalProperties',root,depth+1) then return false;end if;end if;
  end loop;
 elsif typ='array' then
  if s ? 'minItems' and jsonb_array_length(v)<(s->>'minItems')::int then return false;end if;
  if s ? 'maxItems' and jsonb_array_length(v)>(s->>'maxItems')::int then return false;end if;
  if s ? 'items' then for item in select * from jsonb_array_elements(v) loop if not public.hmb_schema_matches(item,s->'items',root,depth+1) then return false;end if;end loop;end if;
 elsif typ='string' then
  if s ? 'minLength' and length(v#>>'{}')<(s->>'minLength')::int then return false;end if;
  if s ? 'maxLength' and length(v#>>'{}')>(s->>'maxLength')::int then return false;end if;
  if s ? 'pattern' and not (v#>>'{}') ~ (s->>'pattern') then return false;end if;
 elsif typ='number' then
  n:=(v::text)::numeric;
  if s ? 'minimum' and n<(s->>'minimum')::numeric then return false;end if;
  if s ? 'maximum' and n>(s->>'maximum')::numeric then return false;end if;
  if s ? 'exclusiveMinimum' and n<=(s->>'exclusiveMinimum')::numeric then return false;end if;
 end if;
 return true;
exception when others then return false;
end $$;
create function public.valid_personal_recipe(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare contract jsonb:=$schema${"$schema":"http://json-schema.org/draft-07/schema#","$id":"https://howmanybeers.app/schemas/cooking-document-v1.json","title":"How Many Beers authored cooking document v1","oneOf":[{"$ref":"#/$defs/recipeDocument"},{"$ref":"#/$defs/mealDocument"}],"$defs":{"temperature":{"type":"object","properties":{"value":{"type":"number","minimum":-273.15,"maximum":2000},"unit":{"enum":["F","C"]},"kind":{"enum":["equipment","food","unknown"]}},"required":["value","unit","kind"],"additionalProperties":false},"action":{"oneOf":[{"type":"object","properties":{"type":{"enum":["prepare","serve","custom"]}},"required":["type"],"additionalProperties":false},{"type":"object","properties":{"type":{"enum":["start_phase","end_phase"]},"phaseId":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"}},"required":["type","phaseId"],"additionalProperties":false},{"type":"object","properties":{"type":{"const":"checkpoint"},"phaseId":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"fraction":{"type":"number","minimum":0,"maximum":100}},"required":["type"],"additionalProperties":false}]},"step":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"type":{"enum":["preparation","instruction","checkpoint","phase-boundary","serving"]},"title":{"type":"string","minLength":1,"maxLength":500},"instructions":{"type":"string","maxLength":16000},"timing":{"type":"object","properties":{"estimatedMinutes":{"anyOf":[{"type":"number","minimum":0,"maximum":43200},{"type":"null"}]},"rangeMinutes":{"type":"array","items":{"type":"number","minimum":0,"maximum":43200},"minItems":2,"maxItems":2}},"required":["estimatedMinutes"],"additionalProperties":false},"condition":{"type":"object","properties":{"description":{"type":"string","maxLength":16000},"manualConfirmation":{"const":true}},"required":["description","manualConfirmation"],"additionalProperties":false},"equipment":{"type":"array","items":{"type":"string","maxLength":16000},"maxItems":50},"temperatures":{"type":"array","items":{"$ref":"#/$defs/temperature"},"maxItems":20},"dependsOn":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"actions":{"type":"array","items":{"$ref":"#/$defs/action"},"maxItems":50},"generated":{"type":"boolean"},"cookingKind":{"enum":["heating","passive"]},"templatePosition":{"type":"object","properties":{"anchor":{"enum":["prep","preheat","start","progress","finish","serve"]},"beforeStartMin":{"type":"number","minimum":0,"maximum":43200},"progress":{"type":"number","minimum":0,"maximum":1}},"required":["anchor"],"additionalProperties":false},"templateStage":{"type":"object","properties":{"kind":{"enum":["preparation","cook","rest","activity"]},"minutes":{"type":"number","minimum":0,"maximum":43200},"after":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"startLabel":{"type":"string","maxLength":16000}},"required":["kind","minutes"],"additionalProperties":false},"nativeCustom":{"type":"object","properties":{"dishName":{"type":"string","maxLength":16000},"isCondition":{"type":"boolean"},"optionalDetails":{"type":"string","maxLength":16000},"durationMinutes":{"anyOf":[{"type":"number","minimum":0,"maximum":43200},{"type":"null"}]},"equipment":{"type":"string","maxLength":16000},"targetTempF":{"type":["number","null"],"minimum":0,"maximum":2000}},"required":["dishName","isCondition"],"additionalProperties":false}},"required":["id","type","title","timing","actions"],"additionalProperties":false},"phase":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"kind":{"enum":["heating","passive"]},"purpose":{"enum":["cook","rest","hold","cool","other"]},"estimatedMinutes":{"anyOf":[{"type":"number","minimum":0,"maximum":43200},{"type":"null"}]},"upperMinutes":{"type":"number","minimum":0,"maximum":43200},"after":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"leadMinutes":{"type":"number","minimum":0,"maximum":43200},"durationStepId":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"}},"required":["id","kind","estimatedMinutes"],"additionalProperties":false},"source":{"type":"object","properties":{"kind":{"enum":["template","customized-template","text","manual","saved-recipe","past-cook"]},"reference":{"type":"string","maxLength":16000},"originalText":{"type":"string","maxLength":16000},"templateId":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"templateVersion":{"type":"integer","minimum":1}},"required":["kind"],"additionalProperties":false},"recipe":{"type":"object","properties":{"method":{"type":"string","maxLength":16000},"equipment":{"type":"array","items":{"type":"string","maxLength":16000},"maxItems":50},"source":{"$ref":"#/$defs/source"},"ingredients":{"type":"array","items":{"type":"string","maxLength":16000},"maxItems":500},"weight":{"type":"object","properties":{"value":{"type":"number","exclusiveMinimum":0,"maximum":100000},"unit":{"enum":["lb","kg","g","oz"]}},"required":["value","unit"],"additionalProperties":false},"yield":{"type":"string","maxLength":16000},"parameters":{"type":"object","maxProperties":50,"propertyNames":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"additionalProperties":{"type":["string","number","boolean","null"]}},"steps":{"type":"array","items":{"$ref":"#/$defs/step"},"maxItems":500,"minItems":1},"phases":{"type":"array","items":{"$ref":"#/$defs/phase"},"maxItems":500},"configuration":{"$ref":"#/$defs/configuration"},"suppressedStepIds":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"review":{"$ref":"#/$defs/review"}},"required":["method","equipment","source","steps","phases"],"additionalProperties":false},"dish":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"name":{"type":"string","minLength":1,"maxLength":500},"sourceRecipe":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"revision":{"type":"integer","minimum":1}},"required":["id","revision"],"additionalProperties":false},"recipe":{"$ref":"#/$defs/recipe"},"planning":{"type":"object","properties":{"stepTimes":{"type":"object","maxProperties":500,"propertyNames":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"additionalProperties":{"type":["string","null"],"maxLength":40}},"stepOrder":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"hiddenStepIds":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500}},"required":[],"additionalProperties":false}},"required":["id","name","recipe"],"additionalProperties":false},"recipeDocument":{"type":"object","properties":{"format":{"const":"how-many-beers"},"schemaVersion":{"const":1},"type":{"const":"recipe"},"id":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"name":{"type":"string","minLength":1,"maxLength":500},"recipe":{"$ref":"#/$defs/recipe"}},"required":["format","schemaVersion","type","id","name","recipe"],"additionalProperties":false},"mealDocument":{"type":"object","properties":{"format":{"const":"how-many-beers"},"schemaVersion":{"const":1},"type":{"const":"meal"},"id":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"name":{"type":"string","minLength":1,"maxLength":500},"serving":{"type":"object","properties":{"local":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$"},"timeZone":{"type":"string","minLength":1,"maxLength":100},"instant":{"type":"string","maxLength":40}},"required":["local","timeZone"],"additionalProperties":false},"dishes":{"type":"array","items":{"$ref":"#/$defs/dish"},"maxItems":100},"generalSteps":{"type":"array","maxItems":500,"items":{"$ref":"#/$defs/step"}},"ordering":{"type":"object","additionalProperties":false,"properties":{"taskOrder":{"type":"array","maxItems":1000,"items":{"$ref":"#/$defs/taskReference"}},"hiddenTasks":{"type":"array","maxItems":1000,"items":{"$ref":"#/$defs/taskReference"}},"generalSequence":{"type":"array","maxItems":500,"items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"}},"generalOverrides":{"type":"object","propertyNames":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxProperties":500,"additionalProperties":{"type":"object","properties":{"title":{"type":"string","maxLength":16000},"instructions":{"type":"string","maxLength":16000},"equipment":{"type":"string","maxLength":16000},"durationMinutes":{"anyOf":[{"type":"number","minimum":0,"maximum":43200},{"type":"null"}]},"targetTempF":{"type":["number","null"],"minimum":0,"maximum":2000},"unscheduled":{"const":true}},"required":[],"additionalProperties":false}}}}},"required":["format","schemaVersion","type","id","name","serving","dishes"],"additionalProperties":false},"configuration":{"type":"object","properties":{"preset":{"enum":["brisket","turkey","ribs","chicken","side","wings","brats","custom"]},"cookMinutes":{"type":"number","minimum":0,"maximum":43200},"restMinutes":{"type":"number","minimum":0,"maximum":43200},"pitTempF":{"type":"number","minimum":-459.67,"maximum":2000},"brisketTemplateVersion":{"const":2},"brisketInputs":{"$ref":"#/$defs/brisketInputs"},"turkeyPrep":{"type":"object","properties":{"state":{"enum":["frozen","thawing","thawed"]},"thawDays":{"type":"number","minimum":0,"maximum":14},"brineHours":{"type":"number","minimum":0,"maximum":48},"dryHours":{"type":"number","minimum":0,"maximum":48}},"required":["state","thawDays","brineHours","dryHours"],"additionalProperties":false},"planningSequence":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"planningStepOrder":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"sourceStepOrder":{"type":"array","maxItems":500,"items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"}}},"required":["preset","cookMinutes","restMinutes"],"additionalProperties":false},"brisketInputs":{"type":"object","properties":{"weightLb":{"type":"number","exclusiveMinimum":0,"maximum":100000},"weightMeasured":{"enum":["trimmed","untrimmed"]},"cut":{"enum":["packer","flat"]},"method":{"enum":["meatchurch-staged-v1","traeger-225-v1"]},"pitTempF":{"type":"number","minimum":0,"maximum":2000},"wrap":{"enum":["paper","foil","none"]},"prepMinutes":{"type":"number","minimum":0,"maximum":43200},"preheatMinutes":{"type":"number","minimum":0,"maximum":43200},"restMinutes":{"type":"number","minimum":0,"maximum":43200},"holdBufferMinutes":{"type":"number","minimum":0,"maximum":43200},"comparePersonal":{"type":"boolean"}},"required":["weightMeasured","cut","method","pitTempF","wrap","prepMinutes","preheatMinutes","restMinutes","holdBufferMinutes","comparePersonal"],"additionalProperties":false},"review":{"type":"object","properties":{"overrides":{"type":"object","propertyNames":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxProperties":500,"additionalProperties":{"type":"object","properties":{"title":{"type":"string","maxLength":16000},"instructions":{"type":"string","maxLength":16000},"equipment":{"type":"string","maxLength":16000},"durationMinutes":{"anyOf":[{"type":"number","minimum":0,"maximum":43200},{"type":"null"}]},"targetTempF":{"type":["number","null"],"minimum":0,"maximum":2000},"unscheduled":{"const":true}},"required":[],"additionalProperties":false}},"hiddenStepIds":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"taskOrder":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"dishSequence":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"dishStepOrder":{"type":"array","items":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},"maxItems":500},"addedSteps":{"type":"array","maxItems":500,"items":{"$ref":"#/$defs/step"}}},"required":[],"additionalProperties":false},"taskReference":{"type":"object","properties":{"dishId":{"anyOf":[{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"},{"type":"null"}]},"stepId":{"type":"string","minLength":1,"maxLength":160,"pattern":"^[A-Za-z0-9_-]+$"}},"required":["dishId","stepId"],"additionalProperties":false}}}$schema$::jsonb; r jsonb; steps jsonb; step jsonb; action jsonb; phase jsonb; ids text[]; phases text[]; seen text[]:=array[]::text[]; key text; list jsonb; amount numeric;
begin
 if d is null or octet_length(d::text)>1048576 or d->>'type'<>'recipe' or public.hmb_schema_matches(d,contract,contract) is distinct from true then return false;end if;
 r:=d->'recipe';steps:=(r->'steps')||coalesce(r#>'{review,addedSteps}','[]'::jsonb);
 select array_agg(x->>'id') into ids from jsonb_array_elements(steps) x;
 select coalesce(array_agg(x->>'id'),array[]::text[]) into phases from jsonb_array_elements(r->'phases') x;
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or cardinality(phases)<>(select count(distinct x) from unnest(phases) x) then return false;end if;
 for step in select * from jsonb_array_elements(steps) loop
  for key in select jsonb_array_elements_text(coalesce(step->'dependsOn','[]')) loop if not key=any(seen) then return false;end if;end loop;
  seen:=array_append(seen,step->>'id');
  if step#>'{timing,rangeMinutes}' is not null then
   if (step#>>'{timing,rangeMinutes,0}')::numeric>(step#>>'{timing,rangeMinutes,1}')::numeric then return false;end if;
   if step#>'{timing,estimatedMinutes}'<>'null'::jsonb and ((step#>>'{timing,estimatedMinutes}')::numeric<(step#>>'{timing,rangeMinutes,0}')::numeric or (step#>>'{timing,estimatedMinutes}')::numeric>(step#>>'{timing,rangeMinutes,1}')::numeric) then return false;end if;
  end if;
  for action in select * from jsonb_array_elements(step->'actions') loop
   if action ? 'phaseId' and not (action->>'phaseId')=any(phases) then return false;end if;
   if action->>'type'='checkpoint' and (action ? 'phaseId')<>(action ? 'fraction') then return false;end if;
  end loop;
 end loop;
 seen:=array[]::text[];
 for phase in select * from jsonb_array_elements(r->'phases') loop
  if phase ? 'after' and not (phase->>'after')=any(seen) then return false;end if;
  if phase ? 'durationStepId' and not (phase->>'durationStepId')=any(ids) then return false;end if;
  if phase ? 'upperMinutes' and phase->'estimatedMinutes'<>'null'::jsonb and (phase->>'upperMinutes')::numeric<(phase->>'estimatedMinutes')::numeric then return false;end if;
  seen:=array_append(seen,phase->>'id');
 end loop;
 for list in select val from (values (r->'suppressedStepIds'),(r#>'{configuration,planningSequence}'),(r#>'{configuration,planningStepOrder}'),(r#>'{configuration,sourceStepOrder}'),(r#>'{review,hiddenStepIds}'),(r#>'{review,taskOrder}'),(r#>'{review,dishSequence}'),(r#>'{review,dishStepOrder}')) a(val) where val is not null loop
  if jsonb_array_length(list)<>(select count(distinct x) from jsonb_array_elements_text(list) x) then return false;end if;
  for key in select jsonb_array_elements_text(list) loop if not key=any(ids) then return false;end if;end loop;
 end loop;
 for key in select jsonb_object_keys(coalesce(r#>'{review,overrides}','{}')) loop if not key=any(ids) then return false;end if;end loop;
 for step in select * from jsonb_array_elements(coalesce(r#>'{review,addedSteps}','[]')) loop
  if not step ? 'nativeCustom' or jsonb_array_length(step->'actions')<>1 or step#>>'{actions,0,type}'<>'custom' then return false;end if;
 end loop;
 return true;
exception when others then return false;
end $$;
create table public.personal_recipes(
 id uuid primary key,owner_user_id uuid not null references auth.users(id) on delete cascade,
 state text not null default 'active' check(state in ('active','deleted')),
 document jsonb not null check(public.valid_personal_recipe(document) and document->>'id'=id::text),
 revision bigint not null default 1 check(revision>0),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),deleted_at timestamptz,
 check((state='deleted')=(deleted_at is not null))
);
create index personal_recipe_owner on public.personal_recipes(owner_user_id,updated_at desc) where state='active';
alter table public.personal_recipes enable row level security;
alter table public.personal_recipes force row level security;
revoke all on public.personal_recipes from public,anon,authenticated;
grant select on public.personal_recipes to authenticated;
create policy personal_recipe_read on public.personal_recipes for select to authenticated using(owner_user_id=(select auth.uid()) and state='active');
create table public.personal_recipe_operations(
 owner_user_id uuid not null references auth.users(id) on delete cascade,operation_id uuid not null,
 kind text not null check(kind in ('save','remove')),recipe_id uuid not null,request_hash bytea not null,
 primary key(owner_user_id,operation_id)
);
alter table public.personal_recipe_operations enable row level security;
alter table public.personal_recipe_operations force row level security;
revoke all on public.personal_recipe_operations from public,anon,authenticated;
create function public.personal_recipe_snapshot(owner_id uuid,recipe_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',id,'state',state,'document',document,'revision',revision,'createdAt',created_at,'updatedAt',updated_at,'deletedAt',deleted_at) from public.personal_recipes where id=recipe_id and owner_user_id=owner_id
$$;
create function public.list_personal_recipes(expected_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
 if owner_id is null or owner_id is distinct from expected_owner then raise exception 'Not authorized' using errcode='42501';end if;
 return jsonb_build_object('recipes',coalesce((select jsonb_agg(public.personal_recipe_snapshot(owner_id,id) order by updated_at desc,id) from public.personal_recipes where owner_user_id=owner_id and state='active'),'[]'::jsonb));
end $$;
create function public.mutate_personal_recipe(expected_owner uuid,target_recipe_id uuid,expected_revision bigint,write_id uuid,operation text,document jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();r public.personal_recipes;receipt public.personal_recipe_operations;request bytea;
begin
 if owner_id is null or owner_id is distinct from expected_owner then raise exception 'Not authorized' using errcode='42501';end if;
 if target_recipe_id is null or write_id is null or expected_revision is null or expected_revision<0 or operation not in ('save','remove') or operation is null then raise exception 'Invalid recipe request' using errcode='23514';end if;
 if operation='save' and (public.valid_personal_recipe(document) is distinct from true or document->>'id' is distinct from target_recipe_id::text) then raise exception 'Invalid recipe document' using errcode='23514';end if;
 if operation='remove' and (document is not null or expected_revision<1) then raise exception 'Invalid recipe removal' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,114));
 request:=sha256(convert_to(jsonb_build_object('id',target_recipe_id,'revision',expected_revision,'operation',operation,'document',document)::text,'UTF8'));
 select * into receipt from public.personal_recipe_operations where owner_user_id=owner_id and operation_id=write_id;
 if found then
  if receipt.kind<>operation or receipt.recipe_id<>target_recipe_id or receipt.request_hash<>request then raise exception 'Operation ID reused' using errcode='23514';end if;
 else
  select * into r from public.personal_recipes where id=target_recipe_id for update;
  if found then
   if r.owner_user_id<>owner_id or r.state<>'active' or r.revision<>expected_revision then raise exception 'Recipe changed or removed' using errcode='40001';end if;
   if operation='save' then update public.personal_recipes p set document=mutate_personal_recipe.document,revision=p.revision+1,updated_at=clock_timestamp() where id=r.id;
   else update public.personal_recipes p set state='deleted',deleted_at=clock_timestamp(),updated_at=clock_timestamp(),revision=p.revision+1 where id=r.id;end if;
  else
   if expected_revision<>0 or operation<>'save' then raise exception 'Recipe changed or removed' using errcode='40001';end if;
   if (select count(*) from public.personal_recipes where owner_user_id=owner_id and state='active')>=500 then raise exception 'Recipe library limit reached' using errcode='23514';end if;
   insert into public.personal_recipes(id,owner_user_id,document) values(target_recipe_id,owner_id,document);
  end if;
  insert into public.personal_recipe_operations values(owner_id,write_id,operation,target_recipe_id,request);
 end if;
 return public.personal_recipe_snapshot(owner_id,target_recipe_id)||jsonb_build_object('receipt',jsonb_build_object('operationId',write_id,'recipeId',target_recipe_id,'operation',operation));
end $$;
revoke all on function public.hmb_schema_matches(jsonb,jsonb,jsonb,integer),public.valid_personal_recipe(jsonb),public.personal_recipe_snapshot(uuid,uuid) from public,anon,authenticated;
revoke all on function public.list_personal_recipes(uuid),public.mutate_personal_recipe(uuid,uuid,bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.list_personal_recipes(uuid),public.mutate_personal_recipe(uuid,uuid,bigint,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
