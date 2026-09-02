<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class DynamoSetup extends Command
{
    protected $signature = 'dynamo:setup {--fresh : Drop and recreate the table} {--seed : Load demo data}';

    protected $description = 'Create the DynamoDB table (and optionally seed demo data).';

    public function handle(): int
    {
        $this->call('dynamo:create-table', $this->option('fresh') ? ['--drop' => true] : []);

        if ($this->option('seed')) {
            $this->call('dynamo:seed');
        }

        return self::SUCCESS;
    }
}
