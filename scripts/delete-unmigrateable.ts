import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_DIRECT_URL || 'http://78.140.57.33:8000'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY не установлен')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const filesToDelete = [
  'CCTV-3.JPG',
  'Image 18.jpg',
  '-кт Мира, 26.xlsx',
  '-соборная 2 гастрноном.xlsx'
]

async function deleteFiles() {
  console.log('Удаление файлов, которые не удалось мигрировать...\n')

  for (const filename of filesToDelete) {
    const { data, error } = await supabase
      .from('zakaz_files')
      .delete()
      .eq('original_filename', filename)
      .not('legacy_path', 'is', null)
      .select()

    if (error) {
      console.log(`❌ Ошибка удаления "${filename}": ${error.message}`)
    } else if (data && data.length > 0) {
      console.log(`✅ Удалено: "${filename}" (ID: ${data[0].id})`)
    } else {
      console.log(`⚠️  Не найдено: "${filename}"`)
    }
  }

  console.log('\nГотово!')
}

deleteFiles()
