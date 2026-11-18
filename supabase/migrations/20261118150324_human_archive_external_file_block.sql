-- Preserve the linked reference PDF as an explicit File block.
begin;
with converted as (
 select record_id,
        jsonb_agg(
          case
            when block->>'html' ilike '%freeman/courses/phil100/17.%' then
              jsonb_set(
                jsonb_set(block, '{type}', '"file"'::jsonb),
                '{html}',
                to_jsonb(replace(block->>'html', 'class="', 'class="ha-file-block '))
              )
            else block
          end
          order by ordinal
        ) as blocks
 from public.human_archive_record_structures,
      lateral jsonb_array_elements(blocks) with ordinality as item(block, ordinal)
 where record_id = 1642
 group by record_id
)
update public.human_archive_record_structures target
set blocks = converted.blocks
from converted
where target.record_id = converted.record_id;
commit;
