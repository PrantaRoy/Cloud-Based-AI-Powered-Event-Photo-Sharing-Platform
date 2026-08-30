<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Event status set changed: `pending` dropped, `ongoing` added, default is
     * now `active`.
     *   - active    : event is published / listed
     *   - scheduled : dated and upcoming
     *   - ongoing   : happening right now
     *   - finished / cancelled / archived : done
     */
    public function up(): void
    {
        DB::table('events')->where('status', 'pending')->update(['status' => 'active']);

        Schema::table('events', function (Blueprint $table) {
            $table->enum('status', ['active', 'scheduled', 'ongoing', 'finished', 'cancelled', 'archived'])
                ->default('active')
                ->change();
        });
    }

    public function down(): void
    {
        DB::table('events')->where('status', 'ongoing')->update(['status' => 'active']);

        Schema::table('events', function (Blueprint $table) {
            $table->enum('status', ['pending', 'scheduled', 'active', 'finished', 'cancelled', 'archived'])
                ->default('pending')
                ->change();
        });
    }
};
