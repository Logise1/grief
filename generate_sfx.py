import math
import struct
import wave
import os
import random

# Create sfx directory if it doesn't exist
os.makedirs('sfx', exist_ok=True)

def write_wav(filename, data):
    """Writes mono 16-bit PCM wave data at 44100Hz."""
    with wave.open(filename, 'wb') as wav_file:
        wav_file.setparams((1, 2, 44100, len(data), 'NONE', 'not compressed'))
        packed_data = struct.pack('<' + 'h' * len(data), *data)
        wav_file.writeframes(packed_data)
    print(f"Generated {filename}")

def generate_jump():
    sample_rate = 44100
    duration = 0.15
    num_samples = int(sample_rate * duration)
    data = []
    phase = 0.0
    for i in range(num_samples):
        t = i / sample_rate
        # Pitch sweep from 120Hz to 350Hz
        freq = 120.0 + (350.0 - 120.0) * (t / duration)
        phase += 2.0 * math.pi * freq / sample_rate
        # Sine wave
        val = math.sin(phase)
        # Exponential volume envelope decay
        env = 0.22 * (1.0 - t / duration)
        data.append(int(val * env * 32767))
    write_wav('sfx/jump.wav', data)

def generate_land():
    sample_rate = 44100
    duration = 0.1
    num_samples = int(sample_rate * duration)
    data = []
    phase = 0.0
    for i in range(num_samples):
        t = i / sample_rate
        # Pitch sweep from 90Hz to 40Hz
        freq = 90.0 + (40.0 - 90.0) * (t / duration)
        phase += 2.0 * math.pi * freq / sample_rate
        val = math.sin(phase)
        env = 0.35 * (1.0 - t / duration)
        data.append(int(val * env * 32767))
    write_wav('sfx/land.wav', data)

def generate_dash():
    sample_rate = 44100
    duration = 0.2
    num_samples = int(sample_rate * duration)
    data = []
    
    # Resonant filter sweep on white noise
    x1, x2 = 0.0, 0.0
    y1, y2 = 0.0, 0.0
    for i in range(num_samples):
        t = i / sample_rate
        # Bandpass filter sweep from 800Hz to 2500Hz
        freq = 800.0 + (2500.0 - 800.0) * (t / duration)
        omega = 2.0 * math.pi * freq / sample_rate
        q = 4.0
        alpha = math.sin(omega) / (2.0 * q)
        cos_w = math.cos(omega)
        b0 = alpha
        b2 = -alpha
        a0 = 1.0 + alpha
        a1 = -2.0 * cos_w
        a2 = 1.0 - alpha
        
        b0 /= a0
        b2 /= a0
        a1 /= a0
        a2 /= a0
        
        x = random.uniform(-1.0, 1.0)
        y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, x
        y2, y1 = y1, y
        
        env = 0.28 * (1.0 - t / duration)
        val = max(-1.0, min(1.0, y))
        data.append(int(val * env * 32767))
    write_wav('sfx/dash.wav', data)

def generate_rewind():
    sample_rate = 44100
    duration = 0.3
    num_samples = int(sample_rate * duration)
    data = []
    phase = 0.0
    y1 = 0.0
    for i in range(num_samples):
        t = i / sample_rate
        # Sawtooth wave sweep from 600Hz down to 100Hz
        freq = 600.0 - 500.0 * (t / duration)
        phase += freq / sample_rate
        osc = (phase % 1.0) * 2.0 - 1.0
        
        # Lowpass filter sweep from 2000Hz to 200Hz
        fc = 2000.0 - 1800.0 * (t / duration)
        omega = 2.0 * math.pi * fc / sample_rate
        alpha = omega / (omega + 1.0)
        y = alpha * osc + (1.0 - alpha) * y1
        y1 = y
        
        env = 0.14 * (1.0 - t / duration)
        data.append(int(y * env * 32767))
    write_wav('sfx/rewind.wav', data)

def generate_death():
    sample_rate = 44100
    duration = 0.4
    num_samples = int(sample_rate * duration)
    data = []
    y1 = 0.0
    for i in range(num_samples):
        t = i / sample_rate
        # Lowpass filtered noise (cutoff 300Hz down to 40Hz)
        fc = 300.0 - 260.0 * (t / duration)
        omega = 2.0 * math.pi * fc / sample_rate
        alpha = omega / (omega + 1.0)
        noise = random.uniform(-1.0, 1.0)
        rumble = alpha * noise + (1.0 - alpha) * y1
        y1 = rumble
        
        # Staircase pitch tone (220Hz -> 110Hz -> 55Hz)
        if t < 0.1:
            f = 220.0
        elif t < 0.2:
            f = 110.0
        else:
            f = 55.0
        osc = ((i * f / sample_rate) % 1.0) * 2.0 - 1.0
        
        env = 1.0 - t / duration
        val = (rumble * 0.45 + osc * 0.18) * env
        val = max(-1.0, min(1.0, val))
        data.append(int(val * 32767))
    write_wav('sfx/death.wav', data)

def generate_transition():
    sample_rate = 44100
    duration = 1.5
    num_samples = int(sample_rate * duration)
    data = []
    phase1 = 0.0
    phase2 = 0.0
    for i in range(num_samples):
        t = i / sample_rate
        # Exponential pitch rise sweeps
        f1 = 220.0 * math.pow(2.0, t / duration)
        f2 = 330.0 * math.pow(2.0, t / duration)
        
        phase1 += 2.0 * math.pi * f1 / sample_rate
        phase2 += 2.0 * math.pi * f2 / sample_rate
        
        val1 = math.sin(phase1)
        # Triangle wave conversion
        tri = (phase2 % (2.0 * math.pi)) / math.pi - 1.0
        val2 = -tri * 2.0 - 1.0 if tri < 0 else tri * 2.0 - 1.0
        
        # Attack envelope, then fade
        if t < duration * 0.4:
            env = 0.22 * (t / (duration * 0.4))
        else:
            env = 0.22 * (1.0 - (t - duration * 0.4) / (duration * 0.6))
            
        val = (val1 * 0.5 + val2 * 0.5) * env
        data.append(int(val * 32767))
    write_wav('sfx/transition.wav', data)

def generate_text_beep():
    sample_rate = 44100
    duration = 0.05
    num_samples = int(sample_rate * duration)
    data = []
    phase = 0.0
    f = 920.0
    for i in range(num_samples):
        t = i / sample_rate
        phase += 2.0 * math.pi * f / sample_rate
        val = math.sin(phase)
        env = 0.02 * (1.0 - t / duration)
        data.append(int(val * env * 32767))
    write_wav('sfx/text_beep.wav', data)

def generate_break_wall():
    sample_rate = 44100
    duration = 0.3
    num_samples = int(sample_rate * duration)
    data = []
    
    # Bandpass filter sweep on white noise
    x1, x2 = 0.0, 0.0
    y1, y2 = 0.0, 0.0
    for i in range(num_samples):
        t = i / sample_rate
        # Bandpass filter sweep from 200Hz to 50Hz
        freq = 200.0 - 150.0 * (t / duration)
        omega = 2.0 * math.pi * freq / sample_rate
        q = 2.0
        alpha = math.sin(omega) / (2.0 * q)
        cos_w = math.cos(omega)
        b0 = alpha
        b2 = -alpha
        a0 = 1.0 + alpha
        a1 = -2.0 * cos_w
        a2 = 1.0 - alpha
        
        b0 /= a0
        b2 /= a0
        a1 /= a0
        a2 /= a0
        
        x = random.uniform(-1.0, 1.0)
        y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, x
        y2, y1 = y1, y
        
        env = 0.35 * (1.0 - t / duration)
        val = max(-1.0, min(1.0, y))
        data.append(int(val * env * 32767))
    write_wav('sfx/break_wall.wav', data)

def generate_thunder():
    sample_rate = 44100
    duration = 2.0
    num_samples = int(sample_rate * duration)
    data = []
    crack_phase = 0.0
    y1 = 0.0
    for i in range(num_samples):
        t = i / sample_rate
        val = 0.0
        
        # 1. Electrical lightning crack (0 to 0.15s)
        if t < 0.15:
            f = 80.0 * math.exp(-t * 15.0)
            crack_phase += f / sample_rate
            crack_val = (crack_phase % 1.0) * 2.0 - 1.0
            crack_env = 0.32 * (1.0 - t / 0.15)
            val += crack_val * crack_env
            
        # 2. Rolling thunder lowpass rumble
        noise = random.uniform(-1.0, 1.0)
        fc = 150.0 * math.exp(-t * 2.0)
        if fc < 30.0:
            fc = 30.0
        omega = 2.0 * math.pi * fc / sample_rate
        alpha = omega / (omega + 1.0)
        rumble = alpha * noise + (1.0 - alpha) * y1
        y1 = rumble
        
        rumble_env = 0.48 * (1.0 - t / duration)
        val += rumble * rumble_env
        
        val = max(-1.0, min(1.0, val))
        data.append(int(val * 32767))
    write_wav('sfx/thunder.wav', data)

def generate_change():
    sample_rate = 44100
    duration = 0.8
    num_samples = int(sample_rate * duration)
    data = []
    phase = 0.0
    for i in range(num_samples):
        t = i / sample_rate
        f = 440.0 * math.exp(-t * 8.0)
        phase += 2.0 * math.pi * f / sample_rate
        
        noise = random.uniform(-1.0, 1.0)
        osc = math.sin(phase) * 0.4 + ((phase / math.pi) % 2.0 - 1.0) * 0.3 + noise * 0.3
        val = max(-1.0, min(1.0, osc * 3.0))
        
        env = 0.35 * (1.0 - t / duration)
        data.append(int(val * env * 32767))
    write_wav('sfx/change.wav', data)

if __name__ == '__main__':
    print("Generating procedural wave sound effects...")
    generate_jump()
    generate_land()
    generate_dash()
    generate_rewind()
    generate_death()
    generate_transition()
    generate_text_beep()
    generate_break_wall()
    generate_thunder()
    generate_change()
    print("Done! All sound effects written to sfx/ directory.")
