<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('event_media_matched_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_media_id')->constrained('event_media')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->enum('match_status', ['matched', 'unmatched'])->default('unmatched');
            $table->timestamp('matched_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('event_media_matched_users');
    }
};
