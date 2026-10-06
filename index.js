import { program } from 'commander';
import fs from 'fs/promises';

// Допоміжна функція: завантаження та парсинг JSON
async function loadData(path) {
    try {
        const data = await fs.readFile(path, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Помилка: Не вдалося прочитати або розпарсити файл "${path}". Перевірте правильність шляху. Код: ${err.code}`);
        process.exit(1);
    }
}

// Допоміжна функція: дістати всі страви єдиним масивом
function getAllDishes(data) {
    let dishes = [];
    if (data && Array.isArray(data.categories)) {
        data.categories.forEach(cat => {
            if (Array.isArray(cat.dishes)) {
                dishes = dishes.concat(cat.dishes);
            }
        });
    }
    return dishes;
}

// Глобальні налаштування програми
program
    .name('restaurant-cli')
    .description('CLI програма для управління меню ресторану')
    .version('1.0.0')
    .option('-d, --data <path>', 'шлях до JSON-файлу з даними', 'data.json');

// Команда 1: Перелік елементів
program
    .command('list')
    .description('Показати стислий список страв (id, назва, ціна)')
    .option('-l, --limit <number>', 'обмежити кількість виведених страв')
    .action(async (options) => {
        const opts = program.opts();
        const data = await loadData(opts.data);
        let dishes = getAllDishes(data);

        if (options.limit) {
            const limit = parseInt(options.limit, 10);
            if (isNaN(limit) || limit <= 0) {
                console.error("Помилка: Ліміт має бути додатним цілим числом.");
                process.exit(1);
            }
            dishes = dishes.slice(0, limit);
        }

        if (dishes.length === 0) {
            console.log("Меню порожнє.");
            return;
        }

        console.log("Список страв:");
        dishes.forEach(d => console.log(`- [${d.id}] ${d.dishName} (${d.price} грн)`));
    });

// Команда 2: Один елемент
program
    .command('get <id>')
    .description('Показати повну інформацію про страву за ID')
    .action(async (id) => {
        const opts = program.opts();
        const data = await loadData(opts.data);
        const dishes = getAllDishes(data);
        const dish = dishes.find(d => d.id === id);

        if (!dish) {
            console.error(`Помилка: Страву з ID "${id}" не знайдено.`);
            process.exit(1);
        }
        console.log(JSON.stringify(dish, null, 2));
    });

// Команда 3: Окреме поле
program
    .command('field <id> <path>')
    .description('Отримати значення конкретного поля страви (наприклад, ingredients.0)')
    .action(async (id, path) => {
        const opts = program.opts();
        const data = await loadData(opts.data);
        const dishes = getAllDishes(data);
        const dish = dishes.find(d => d.id === id);

        if (!dish) {
            console.error(`Помилка: Страву з ID "${id}" не знайдено.`);
            process.exit(1);
        }

        const keys = path.split('.');
        let result = dish;

        for (const key of keys) {
            if (result === undefined || result === null) break;
            result = result[key];
        }

        if (result === undefined) {
            console.error(`Помилка: Поле "${path}" відсутнє у страви ${id}.`);
            process.exit(1);
        }

        if (result === null) {
            console.log(`Поле "${path}" має значення null (дані не вказані).`);
        } else {
            console.log(`Значення поля ${path}:`, result);
        }
    });

// Команда 4: Страви однієї категорії (Варіант 2)
program
    .command('category <name>')
    .description('Показати всі страви з певної категорії')
    .action(async (name) => {
        const opts = program.opts();
        const data = await loadData(opts.data);
        
        if (!data.categories) {
            console.error("Помилка: Структура JSON не містить масиву categories.");
            process.exit(1);
        }

        const cat = data.categories.find(c => c.categoryName.toLowerCase() === name.toLowerCase());
        
        if (!cat) {
            console.error(`Помилка: Категорію "${name}" не знайдено.`);
            process.exit(1);
        }

        if (!cat.dishes || cat.dishes.length === 0) {
            console.log(`Категорія "${name}" порожня.`);
            return;
        }

        console.log(`Страви в категорії "${cat.categoryName}":`);
        cat.dishes.forEach(d => console.log(`- ${d.dishName}`));
    });

// Команда 5: Відбір страв за позначками та ціною (Варіант 2)
program
    .command('filter')
    .description('Відібрати страви за ціною та позначками')
    .option('--spicy', 'показати тільки гострі страви')
    .option('--veg', 'показати тільки вегетаріанські страви')
    .option('--max-price <number>', 'максимальна ціна страви')
    .action(async (options) => {
        const opts = program.opts();
        const data = await loadData(opts.data);
        let dishes = getAllDishes(data);

        if (options.spicy) {
            dishes = dishes.filter(d => d.isSpicy === true);
        }
        
        if (options.veg) {
            dishes = dishes.filter(d => d.isVegetarian === true);
        }
        
        if (options.maxPrice) {
            const max = parseFloat(options.maxPrice);
            if (isNaN(max) || max < 0) {
                console.error("Помилка: Максимальна ціна має бути додатним числом.");
                process.exit(1);
            }
            dishes = dishes.filter(d => d.price <= max);
        }

        if (dishes.length === 0) {
            console.log("За вказаними критеріями страв не знайдено.");
            return;
        }

        console.log("Знайдені страви:");
        dishes.forEach(d => console.log(`- ${d.dishName} (${d.price} грн)`));
    });

// Команда 6: Пошук за інгредієнтом (Варіант 2)
program
    .command('ingredient <name>')
    .description('Пошук страв, що містять вказаний інгредієнт')
    .action(async (name) => {
        const opts = program.opts();
        const data = await loadData(opts.data);
        const dishes = getAllDishes(data);

        const found = dishes.filter(d => 
            Array.isArray(d.ingredients) && 
            d.ingredients.some(ing => ing.toLowerCase().includes(name.toLowerCase()))
        );

        if (found.length === 0) {
            console.log(`Страв з інгредієнтом "${name}" не знайдено.`);
            return;
        }

        console.log(`Страви, що містять "${name}":`);
        found.forEach(d => console.log(`- ${d.dishName}`));
    });

program.parse(process.argv);