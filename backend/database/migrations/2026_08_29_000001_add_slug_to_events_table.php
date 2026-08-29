<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
        });

        DB::table('events')->orderBy('id')->select('id', 'name')->cursor()->each(function ($row) {
            $base = Str::slug($row->name) ?: 'event';

            do {
                $slug = $base.'-'.Str::lower(Str::random(6));
            } while (DB::table('events')->where('slug', $slug)->exists());

            DB::table('events')->where('id', $row->id)->update(['slug' => $slug]);
        });

        Schema::table('events', function (Blueprint $table) {
            $table->unique('slug');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
