<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Coordinates were originally created as nullable strings. Store them as
     * fixed-precision decimals so map-picked latitude/longitude round-trip
     * cleanly (lat: -90..90, lng: -180..180, ~1cm precision at 7 dp).
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->decimal('latitude', 10, 7)->nullable()->change();
            $table->decimal('longitude', 10, 7)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('latitude')->nullable()->change();
            $table->string('longitude')->nullable()->change();
        });
    }
};
